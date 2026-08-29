package com.hellomq.artemis;

import com.hellomq.shared.Envelope;
import com.hellomq.shared.IdempotencyStore;
import com.hellomq.shared.Json;
import com.hellomq.shared.LabLogger;
import jakarta.jms.MessageConsumer;
import jakarta.jms.Session;
import jakarta.jms.TextMessage;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 消费者：CLIENT_ACKNOWLEDGE 会话，业务事务提交后才 acknowledge（§5.4 崩溃窗口同样适用）。
 * --fail-aggregate 命中的消息不 ack 并 session.recover()，由 Broker 按 address-setting
 * （max-delivery-attempts/redelivery-delay/dead-letter-address）重投并在耗尽后转 DLQ。
 * --no-business 只收不写库（DLQ 观察专用：毒消息业务载荷本就非法）。
 */
public final class Consumer {

  public static void run(Args args) throws Exception {
    String lab = args.get("lab", "unknown");
    String queueName = args.require("queue");
    String name = args.get("consumer", "consumer-1");
    String dbPath = args.require("db");
    int expected = args.getInt("expected", -1);
    String failAggregate = args.get("fail-aggregate", "");
    int maxAttempts = args.getInt("max-attempts", 3);
    long hardTimeoutMs = args.getInt("hard-timeout-ms", 110_000);
    boolean noBusiness = args.has("no-business");

    LabLogger log = LabLogger.of("consumer", "artemis", lab, "order-service");
    AtomicInteger businessCommitted = new AtomicInteger();
    Map<String, Integer> failedAttempts = new ConcurrentHashMap<>();

    try (IdempotencyStore store = new IdempotencyStore(dbPath, lab);
        var connection = Broker.connect();
        Session session = connection.createSession(false, Session.CLIENT_ACKNOWLEDGE)) {
      var queue = session.createQueue(queueName);
      long startedAt = System.currentTimeMillis();
      long lastMessageAt = startedAt;
      int received = 0;

      try (MessageConsumer consumer = session.createConsumer(queue)) {
        log.entry()
            .put("destination", queueName)
            .put("consumer", name)
            .status("subscribed")
            .emit();

        while (true) {
          var message = consumer.receive(1000);
          if (message instanceof TextMessage text) {
            lastMessageAt = System.currentTimeMillis();
            received++;
            Envelope envelope = Json.mapper().readValue(text.getText(), Envelope.class);
            int attempt = failedAttempts.merge(envelope.getMessageId(), 1, Integer::sum);
            // 已 ack 的正常消息不会再见到；见到即说明发生过 recover/重投
            boolean redelivered = attempt > 1 || message.getJMSRedelivered();

            var entry =
                log.entry()
                    .envelope(envelope)
                    .put("destination", queueName)
                    .put("seq", text.getStringProperty("seq"))
                    .put("consumer", name)
                    .put("attempt", attempt)
                    .put("redelivered", redelivered);
            long sentAt = text.getLongProperty("sentAt");
            if (sentAt > 0) {
              entry.put("deliveryDelayMs", System.currentTimeMillis() - sentAt);
            }
            entry.status("received").emit();

            if (!failAggregate.isEmpty() && failAggregate.equals(envelope.getAggregateId())) {
              log.entry()
                  .envelope(envelope)
                  .put("destination", queueName)
                  .put("consumer", name)
                  .put("attempt", attempt)
                  .status("consume_failed")
                  .emit();
              // 不 ack：recover 让 Broker 重投未确认消息；超过 max-delivery-attempts 后由服务端转 DLQ。
              session.recover();
            } else if (noBusiness) {
              log.entry()
                  .envelope(envelope)
                  .put("destination", queueName)
                  .put("consumer", name)
                  .put("attempt", attempt)
                  .status("inspected")
                  .emit();
              message.acknowledge();
            } else {
              IdempotencyStore.Result result = store.process(envelope, IdempotencyStore.orderWriter());
              String status =
                  result == IdempotencyStore.Result.PROCESSED ? "business_committed" : "duplicate_skipped";
              if (result == IdempotencyStore.Result.PROCESSED) {
                businessCommitted.incrementAndGet();
              }
              log.entry()
                  .envelope(envelope)
                  .put("destination", queueName)
                  .put("consumer", name)
                  .put("attempt", attempt)
                  .status(status)
                  .emit();
              message.acknowledge();
            }
          }

          boolean expectedReached =
              expected < 0 || (noBusiness ? received >= expected : businessCommitted.get() >= expected);
          boolean poisonDone =
              failAggregate.isEmpty()
                  || failedAttempts.values().stream().anyMatch((a) -> a >= maxAttempts);
          long now = System.currentTimeMillis();
          // 最后一次 recover 后给 Broker 留出 DLQ 转移窗口；如果仍继续重投，下一条消息会重置等待时间。
          boolean poisonSettled = failAggregate.isEmpty() || (poisonDone && now - lastMessageAt >= 2_000);
          if (expectedReached && poisonSettled) break;
          if (now - startedAt > hardTimeoutMs) break;
        }
      }
      log.entry()
          .put("destination", queueName)
          .put("consumer", name)
          .put("received", received)
          .put("poisonMaxAttempt", failedAttempts.values().stream().mapToInt(Integer::intValue).max().orElse(0))
          .status("done")
          .emit();
    }
  }
}
