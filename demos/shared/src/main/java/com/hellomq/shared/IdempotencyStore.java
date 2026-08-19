package com.hellomq.shared;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.List;
import java.util.stream.Stream;

/**
 * 幂等消费基准实现（规格 §5.4）：processed_messages 唯一键表 + 业务写入在同一本地事务内，
 * 提交成功后才由调用方提交 Broker 确认。
 */
public final class IdempotencyStore implements AutoCloseable {

  public enum Result {
    PROCESSED,
    DUPLICATE_SKIPPED
  }

  @FunctionalInterface
  public interface BusinessWriter {
    void write(Connection conn, Envelope envelope) throws Exception;
  }

  private final Connection conn;
  private final String lab;

  public IdempotencyStore(String dbPath, String lab) throws SQLException, IOException {
    Path path = Path.of(dbPath);
    if (path.getParent() != null) {
      Files.createDirectories(path.getParent());
    }
    this.conn = DriverManager.getConnection("jdbc:sqlite:" + dbPath);
    this.lab = lab;
    initSchema();
  }

  private void initSchema() throws SQLException {
    try (Statement st = conn.createStatement()) {
      st.execute(
          """
          CREATE TABLE IF NOT EXISTS processed_messages (
            message_id TEXT PRIMARY KEY,
            processed_at TEXT NOT NULL,
            lab TEXT NOT NULL
          )
          """);
      st.execute(
          """
          CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            amount_cents INTEGER NOT NULL,
            currency TEXT NOT NULL,
            message_id TEXT NOT NULL,
            created_at TEXT NOT NULL
          )
          """);
    }
  }

  /**
   * 在同一本地事务中记录幂等键并执行业务写入。唯一键冲突时返回 DUPLICATE_SKIPPED；
   * 业务失败时回滚并抛出异常（调用方应拒绝消息、进入重试/DLQ）。
   */
  public Result process(Envelope envelope, BusinessWriter writer) throws SQLException {
    conn.setAutoCommit(false);
    try {
      insertProcessedMessage(envelope);
      writer.write(conn, envelope);
      conn.commit();
      return Result.PROCESSED;
    } catch (SQLException e) {
      conn.rollback();
      if (isUniqueViolation(e)) {
        return Result.DUPLICATE_SKIPPED;
      }
      throw e;
    } catch (Exception e) {
      conn.rollback();
      throw new RuntimeException("business write failed: " + e.getMessage(), e);
    } finally {
      conn.setAutoCommit(true);
    }
  }

  private void insertProcessedMessage(Envelope envelope) throws SQLException {
    try (PreparedStatement ps =
        conn.prepareStatement(
            "INSERT INTO processed_messages (message_id, processed_at, lab) VALUES (?, ?, ?)")) {
      ps.setString(1, envelope.getMessageId());
      ps.setString(2, Instant.now().toString());
      ps.setString(3, lab);
      ps.executeUpdate();
    }
  }

  private static boolean isUniqueViolation(SQLException e) {
    String msg = String.valueOf(e.getMessage());
    return msg.contains("UNIQUE constraint failed") || msg.contains("[SQLITE_CONSTRAINT_PRIMARYKEY]");
  }

  /** 订单业务写入：校验必填字段与金额非负（毒消息在这里确定性失败）。 */
  public static BusinessWriter orderWriter() {
    return (conn, env) -> {
      Envelope.OrderCreatedPayload p = env.getPayload();
      if (p == null || p.getOrderId() == null || p.getCustomerId() == null
          || p.getAmount() == null || p.getCurrency() == null) {
        throw new IllegalArgumentException("invalid order payload: missing required fields");
      }
      if (p.getAmount().signum() < 0) {
        throw new IllegalArgumentException("invalid order payload: negative amount");
      }
      long amountCents = p.getAmount().multiply(BigDecimal.valueOf(100)).longValueExact();
      try (PreparedStatement ps =
          conn.prepareStatement(
              """
              INSERT INTO orders (order_id, customer_id, amount_cents, currency, message_id, created_at)
              VALUES (?, ?, ?, ?, ?, ?)
              """)) {
        ps.setString(1, p.getOrderId());
        ps.setString(2, p.getCustomerId());
        ps.setLong(3, amountCents);
        ps.setString(4, p.getCurrency());
        ps.setString(5, env.getMessageId());
        ps.setString(6, Instant.now().toString());
        ps.executeUpdate();
      }
    };
  }

  public long businessRowCount() throws SQLException {
    try (Statement st = conn.createStatement();
        ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM orders")) {
      return rs.next() ? rs.getLong(1) : 0;
    }
  }

  public long processedCount() throws SQLException {
    try (Statement st = conn.createStatement();
        ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM processed_messages")) {
      return rs.next() ? rs.getLong(1) : 0;
    }
  }

  public static List<Path> orderFixtures(Path dir) throws IOException {
    try (Stream<Path> s = Files.list(dir)) {
      return s.filter(p -> {
            String name = p.getFileName().toString();
            return name.startsWith("order-") && name.endsWith(".json");
          })
          .sorted()
          .toList();
    }
  }

  public static Envelope loadEnvelope(Path file) throws IOException {
    return Json.mapper().readValue(Files.readString(file), Envelope.class);
  }

  @Override
  public void close() throws SQLException {
    conn.close();
  }
}
