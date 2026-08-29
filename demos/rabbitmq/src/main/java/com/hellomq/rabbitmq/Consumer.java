package com.hellomq.rabbitmq;

import com.hellomq.shared.Envelope;
import com.hellomq.shared.IdempotencyStore;
import com.hellomq.shared.Json;
import com.hellomq.shared.LabLogger;
import com.hellomq.shared.ReplayGate;
import com.rabbitmq.client.AMQP;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.Delivery;
import java.util.List;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 消费者：手动 ACK + prefetch=1 + 幂等落库（规格 §5.4）。
 * --crash-before-ack-at=N：第 N 条业务提交后、ACK 前 halt(137)，用于崩溃注入。
 * --retry-mode：读取 x-death 计数决定重试或送 DLQ（TTL+DLX 回环）。
 */
public final class Consumer {

  private final Args args;
  private final LabLogger log;
  private final IdempotencyStore store;
  private final boolean retryMode;
  private final int maxAttempts;
  private final String dlq;
  private final int expectedOk;
  private final int expected;
  private final int crashAt;

  private final AtomicInteger received = new AtomicInteger();
  private final AtomicInteger acked = new AtomicInteger();
  private final AtomicInteger okCount = new AtomicInteger();
  private final AtomicBoolean poisonDlqed = new AtomicBoolean(false);

  private Consumer(Args args, IdempotencyStore store) {
    this.args = args;
    this.store = store;
    this.log = LabLogger.of("consumer", "rabbitmq", args.get("lab", "unknown"), "order-service");
    this.retryMode = args.has("retry-mode");
    this.maxAttempts = args.getInt("max-attempts", 3);
    this.dlq = args.get("dlq", Topology.QUEUE_DLQ);
    this.expectedOk = args.getInt("expected-ok", -1);
    this.expected = args.getInt("expected", -1);
    this.crashAt = args.getInt("crash-before-ack-at", -1);
  }

  public static void run(Args args) throws Exception {
    String dbPath = args.require("db");
    try (IdempotencyStore store = new IdempotencyStore(dbPath, args.get("lab", "unknown"))) {
      new Consumer(args, store).consume();
    }
  }

  private void consume() throws Exception {
    String uri = args.get("uri", Broker.DEFAULT_URI);
    String queue = args.require("queue");
    try (Connection connection = Broker.connect(uri);
        Channel channel = connection.createChannel()) {
      channel.queueDeclarePassive(queue);
      channel.basicQos(1);

      Timer watchdog = new Timer(true);
      watchdog.schedule(
          new TimerTask() {
            @Override
            public void run() {
              log.entry().put("queue", queue).put("received", received.get()).status("timeout").emit();
              System.exit(1);
            }
          },
          120_000);

      channel.basicConsume(
          queue,
          false,
          (consumerTag, delivery) -> {
            try {
              handle(channel, queue, delivery);
            } catch (Exception e) {
              throw new java.io.IOException(e);
            }
          },
          consumerTag -> {});

      synchronized (this) {
        while (!finished()) {
          wait(500);
        }
      }
      watchdog.cancel();
      log.entry().put("queue", queue).put("received", received.get()).status("done").emit();
    }
  }

  private boolean finished() {
    if (retryMode) {
      return expectedOk >= 0 && okCount.get() >= expectedOk && poisonDlqed.get();
    }
    return expected >= 0 && acked.get() >= expected;
  }

  private void handle(Channel channel, String queue, Delivery delivery) throws Exception {
    received.incrementAndGet();
    Envelope envelope = Json.mapper().readValue(delivery.getBody(), Envelope.class);
    int attempt = retryMode ? 1 + xDeathRejectedCount(delivery.getProperties()) : 1;

    log.entry()
        .envelope(envelope)
        .put("destination", queue)
        .put("consumer", "consumer-1")
        .put("attempt", attempt)
        .put("redelivered", delivery.getEnvelope().isRedeliver())
        .status("received")
        .emit();
    ReplayGate.awaitCheckpoint("after-delivery", envelope.getMessageId());

    try {
      IdempotencyStore.Result result = store.process(envelope, IdempotencyStore.orderWriter());
      if (result == IdempotencyStore.Result.PROCESSED) {
        log.entry().envelope(envelope).put("destination", queue).put("attempt", attempt).status("business_committed").emit();
        ReplayGate.awaitCheckpoint("before-ack", envelope.getMessageId());
        if (!retryMode && crashAt > 0 && okCount.get() + 1 == crashAt) {
          log.entry().envelope(envelope).put("destination", queue).status("crash_injected").emit();
          Runtime.getRuntime().halt(137);
        }
        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
        okCount.incrementAndGet();
      } else {
        log.entry().envelope(envelope).put("destination", queue).put("attempt", attempt).status("duplicate_skipped").emit();
        ReplayGate.awaitCheckpoint("before-ack", envelope.getMessageId());
        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
        okCount.incrementAndGet();
      }
    } catch (RuntimeException businessFailure) {
      if (!retryMode) {
        log.entry()
            .envelope(envelope)
            .put("destination", queue)
            .put("errorType", businessFailure.getClass().getSimpleName())
            .status("business_failed")
            .emit();
        channel.basicNack(delivery.getEnvelope().getDeliveryTag(), false, false);
      } else if (attempt >= maxAttempts) {
        ReplayGate.awaitCheckpoint("before-dlq", envelope.getMessageId());
        channel.basicPublish("", dlq, delivery.getProperties(), delivery.getBody());
        log.entry().envelope(envelope).put("destination", queue).put("attempt", attempt).status("poison_to_dlq").emit();
        channel.basicAck(delivery.getEnvelope().getDeliveryTag(), false);
        poisonDlqed.set(true);
      } else {
        log.entry().envelope(envelope).put("destination", queue).put("attempt", attempt).status("retry").emit();
        ReplayGate.awaitCheckpoint("before-retry", envelope.getMessageId());
        channel.basicNack(delivery.getEnvelope().getDeliveryTag(), false, false);
      }
    }
    acked.incrementAndGet();
    synchronized (this) {
      notifyAll();
    }
  }

  private static int xDeathRejectedCount(AMQP.BasicProperties properties) {
    if (properties == null || properties.getHeaders() == null) {
      return 0;
    }
    Object xDeath = properties.getHeaders().get("x-death");
    if (!(xDeath instanceof List<?> entries)) {
      return 0;
    }
    int total = 0;
    for (Object entry : entries) {
      if (entry instanceof Map<?, ?> map && "rejected".equals(String.valueOf(map.get("reason")))) {
        Object count = map.get("count");
        if (count instanceof Number number) {
          total += number.intValue();
        }
      }
    }
    return total;
  }
}
