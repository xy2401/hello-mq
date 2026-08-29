package com.hellomq.redisstreams;

import com.hellomq.shared.Envelope;
import com.hellomq.shared.IdempotencyStore;
import com.hellomq.shared.Json;
import com.hellomq.shared.LabLogger;
import com.hellomq.shared.ReplayGate;
import java.util.List;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.atomic.AtomicInteger;
import redis.clients.jedis.Jedis;
import redis.clients.jedis.StreamEntryID;
import redis.clients.jedis.params.XClaimParams;
import redis.clients.jedis.params.XPendingParams;
import redis.clients.jedis.params.XReadGroupParams;
import redis.clients.jedis.resps.StreamEntry;
import redis.clients.jedis.resps.StreamPendingEntry;

/**
 * 消费者：XREADGROUP 逐条读取 + 业务落库后才 XACK（规格 §5.4）。
 * --crash-before-ack-at=N：第 N 条业务提交后、XACK 前 halt(137)，条目滞留 PEL。
 * --claim：启动时先用 XPENDING/XCLAIM 接管组内未确认条目（重投递路径）。
 */
public final class Consumer {

  private final Args args;
  private final LabLogger log;
  private final IdempotencyStore store;
  private final int expected;
  private final int crashAt;
  private final boolean claim;

  private final AtomicInteger acked = new AtomicInteger();

  private Consumer(Args args, IdempotencyStore store) {
    this.args = args;
    this.store = store;
    this.log = LabLogger.of("consumer", "redis-streams", args.get("lab", "unknown"), "order-service");
    this.expected = args.getInt("expected", -1);
    this.crashAt = args.getInt("crash-before-ack-at", -1);
    this.claim = args.has("claim");
  }

  public static void run(Args args) throws Exception {
    String dbPath = args.require("db");
    try (IdempotencyStore store = new IdempotencyStore(dbPath, args.get("lab", "unknown"))) {
      new Consumer(args, store).consume();
    }
  }

  private void consume() throws Exception {
    String stream = args.require("stream");
    String group = args.require("group");
    String consumer = args.get("consumer", "consumer-1");
    try (Jedis jedis = Broker.connect(Broker.DEFAULT_HOST, Broker.DEFAULT_PORT)) {
      Timer watchdog = new Timer(true);
      watchdog.schedule(
          new TimerTask() {
            @Override
            public void run() {
              log.entry().put("stream", stream).put("acked", acked.get()).status("timeout").emit();
              System.exit(1);
            }
          },
          120_000);

      if (claim) {
        claimPending(jedis, stream, group, consumer);
      }

      while (expected < 0 || acked.get() < expected) {
        List<Map.Entry<String, List<StreamEntry>>> result =
            jedis.xreadGroup(
                group,
                consumer,
                XReadGroupParams.xReadGroupParams().count(1).block(500),
                Map.of(stream, StreamEntryID.UNRECEIVED_ENTRY));
        if (result == null) {
          continue;
        }
        for (Map.Entry<String, List<StreamEntry>> byStream : result) {
          for (StreamEntry entry : byStream.getValue()) {
            handle(jedis, stream, group, consumer, entry, 1, false);
          }
        }
      }
      watchdog.cancel();
      log.entry().put("stream", stream).put("consumer", consumer).put("acked", acked.get()).status("done").emit();
    }
  }

  /** XPENDING 查看组内未确认条目，XCLAIM 移交给自己后重新处理。 */
  private void claimPending(Jedis jedis, String stream, String group, String consumer) {
    List<StreamPendingEntry> pending = jedis.xpending(stream, group, XPendingParams.xPendingParams().count(100));
    if (pending == null || pending.isEmpty()) {
      return;
    }
    for (StreamPendingEntry pe : pending) {
      List<StreamEntry> claimed =
          jedis.xclaim(stream, group, consumer, 0, XClaimParams.xClaimParams(), pe.getID());
      if (claimed == null) {
        continue;
      }
      for (StreamEntry entry : claimed) {
        if (entry != null) {
          handle(jedis, stream, group, consumer, entry, (int) pe.getDeliveredTimes(), true);
        }
      }
    }
  }

  private void handle(Jedis jedis, String stream, String group, String consumer, StreamEntry entry, int attempt, boolean redelivered) {
    try {
      Envelope envelope = Json.mapper().readValue(entry.getFields().get("data"), Envelope.class);
      log.entry()
          .envelope(envelope)
          .put("destination", stream)
          .put("consumer", consumer)
          .put("entryId", entry.getID().toString())
          .put("attempt", attempt)
          .put("redelivered", redelivered)
          .status("received")
          .emit();
      ReplayGate.awaitCheckpoint("after-delivery", envelope.getMessageId());

      IdempotencyStore.Result result = store.process(envelope, IdempotencyStore.orderWriter());
      if (result == IdempotencyStore.Result.PROCESSED) {
        log.entry().envelope(envelope).put("destination", stream).put("attempt", attempt).status("business_committed").emit();
        if (crashAt > 0 && acked.get() + 1 == crashAt) {
          log.entry().envelope(envelope).put("destination", stream).status("crash_injected").emit();
          Runtime.getRuntime().halt(137);
        }
      } else {
        log.entry().envelope(envelope).put("destination", stream).put("attempt", attempt).status("duplicate_skipped").emit();
      }
      ReplayGate.awaitCheckpoint("before-xack", envelope.getMessageId());
      jedis.xack(stream, group, entry.getID());
      acked.incrementAndGet();
    } catch (Exception e) {
      // 不 XACK：条目继续留在 PEL，等待后续 XCLAIM/重试（本实验不注入业务失败）
      log.entry()
          .put("destination", stream)
          .put("entryId", entry.getID().toString())
          .put("errorType", e.getClass().getSimpleName())
          .status("business_failed")
          .emit();
    }
  }
}
