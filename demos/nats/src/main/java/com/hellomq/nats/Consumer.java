package com.hellomq.nats;

import com.hellomq.shared.Envelope;
import com.hellomq.shared.IdempotencyStore;
import com.hellomq.shared.Json;
import com.hellomq.shared.LabLogger;
import io.nats.client.Connection;
import io.nats.client.Dispatcher;
import io.nats.client.JetStream;
import io.nats.client.JetStreamSubscription;
import io.nats.client.Message;
import io.nats.client.PullSubscribeOptions;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * 消费者：--mode=core 用 Dispatcher 订阅（无确认概念）；--mode=jetstream 用
 * durable pull consumer，业务落库成功后才 ackSync（规格 §5.4）。
 */
public final class Consumer {

  private final Args args;
  private final LabLogger log;
  private final IdempotencyStore store;
  private final int expected;

  private Consumer(Args args, IdempotencyStore store) {
    this.args = args;
    this.store = store;
    this.log = LabLogger.of("consumer", "nats", args.get("lab", "unknown"), "order-service");
    this.expected = args.getInt("expected", -1);
  }

  public static void run(Args args) throws Exception {
    String dbPath = args.require("db");
    try (IdempotencyStore store = new IdempotencyStore(dbPath, args.get("lab", "unknown"))) {
      new Consumer(args, store).consume();
    }
  }

  private void consume() throws Exception {
    String subject = args.require("subject");
    String mode = args.require("mode");
    String consumerName = args.get("consumer", mode.equals("jetstream") ? args.require("durable") : "consumer-1");

    try (Connection nc = Broker.connect(Broker.DEFAULT_URL)) {
      if (mode.equals("core")) {
        consumeCore(nc, subject, consumerName);
      } else {
        consumeJetStream(nc, subject, consumerName);
      }
    }
  }

  private void consumeCore(Connection nc, String subject, String consumerName) throws Exception {
    CountDownLatch latch = new CountDownLatch(Math.max(expected, 0));
    Dispatcher dispatcher =
        nc.createDispatcher(
            (msg) -> {
              try {
                handle(subject, consumerName, msg.getData());
              } catch (Exception e) {
                log.entry()
                    .put("destination", subject)
                    .put("errorType", e.getClass().getSimpleName())
                    .status("business_failed")
                    .emit();
              } finally {
                latch.countDown();
              }
            });
    dispatcher.subscribe(subject);
    nc.flush(Duration.ofSeconds(5));
    log.entry().put("destination", subject).put("consumer", consumerName).status("subscribed").emit();

    if (!latch.await(120, TimeUnit.SECONDS)) {
      log.entry().put("destination", subject).status("timeout").emit();
      System.exit(1);
    }
    log.entry().put("destination", subject).put("consumer", consumerName).status("done").emit();
  }

  private void consumeJetStream(Connection nc, String subject, String durable) throws Exception {
    JetStream js = nc.jetStream();
    JetStreamSubscription sub =
        js.subscribe(subject, PullSubscribeOptions.builder().durable(durable).build());

    long deadline = System.currentTimeMillis() + 120_000;
    int acked = 0;
    while (expected < 0 || acked < expected) {
      if (System.currentTimeMillis() > deadline) {
        log.entry().put("destination", subject).put("consumer", durable).status("timeout").emit();
        System.exit(1);
      }
      List<Message> messages = sub.fetch(1, Duration.ofSeconds(5));
      for (Message msg : messages) {
        handle(subject, durable, msg.getData());
        msg.ackSync(Duration.ofSeconds(5));
        acked++;
      }
    }
    log.entry().put("destination", subject).put("consumer", durable).put("acked", acked).status("done").emit();
  }

  private void handle(String subject, String consumerName, byte[] data) throws Exception {
    Envelope envelope = Json.mapper().readValue(data, Envelope.class);
    log.entry()
        .envelope(envelope)
        .put("destination", subject)
        .put("consumer", consumerName)
        .put("attempt", 1)
        .put("redelivered", false)
        .status("received")
        .emit();

    IdempotencyStore.Result result = store.process(envelope, IdempotencyStore.orderWriter());
    if (result == IdempotencyStore.Result.PROCESSED) {
      log.entry().envelope(envelope).put("destination", subject).status("business_committed").emit();
    } else {
      log.entry().envelope(envelope).put("destination", subject).status("duplicate_skipped").emit();
    }
  }
}
