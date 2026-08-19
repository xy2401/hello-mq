package com.hellomq.pulsar;

import com.hellomq.shared.Envelope;
import com.hellomq.shared.IdempotencyStore;
import com.hellomq.shared.Json;
import com.hellomq.shared.LabLogger;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;
import org.apache.pulsar.client.api.ConsumerBuilder;
import org.apache.pulsar.client.api.DeadLetterPolicy;
import org.apache.pulsar.client.api.Message;
import org.apache.pulsar.client.api.PulsarClient;
import org.apache.pulsar.client.api.SubscriptionType;

/**
 * 消费者：业务事务提交后才 ack（§5.4 崩溃窗口同样适用）。
 * --sub-type 支持四类订阅；--fail-aggregate 命中的消息 negativeAcknowledge，
 * 配合 DeadLetterPolicy 达到 maxRedeliverCount 后进 DLQ（redelivery-replay 实验）。
 */
public final class Consumer {

  public static void run(Args args) throws Exception {
    String serviceUrl = args.get("service-url", "pulsar://127.0.0.1:6650");
    String lab = args.get("lab", "unknown");
    String topic = args.require("topic");
    String subscription = args.require("subscription");
    String subType = args.get("sub-type", "Exclusive");
    String name = args.get("consumer", "consumer-1");
    String dbPath = args.require("db");
    int expected = args.getInt("expected", -1);
    long idleExitMs = args.getInt("idle-exit-ms", -1);
    long hardTimeoutMs = args.getInt("hard-timeout-ms", 110_000);
    String failAggregate = args.get("fail-aggregate", "");
    int maxRedeliver = args.getInt("max-redeliver", 2);
    boolean noBusiness = args.has("no-business");
    int priority = args.getInt("priority", 0);
    long totalExitMs = args.getInt("total-exit-ms", -1);

    LabLogger log = LabLogger.of("consumer", "pulsar", lab, "order-service");
    try (IdempotencyStore store = new IdempotencyStore(dbPath, lab);
        PulsarClient client = PulsarClient.builder().serviceUrl(serviceUrl).build()) {

      ConsumerBuilder<byte[]> builder =
          client
              .newConsumer()
              .topic(topic)
              .subscriptionName(subscription)
              .subscriptionType(SubscriptionType.valueOf(subType))
              .consumerName(name)
              .priorityLevel(priority)
              // 默认 60s 太慢；redelivery-replay 实验依赖快速重投
              .negativeAckRedeliveryDelay(500, TimeUnit.MILLISECONDS);
      if (!failAggregate.isEmpty()) {
        builder.deadLetterPolicy(
            DeadLetterPolicy.builder().maxRedeliverCount(maxRedeliver).build());
      }

      try (var consumer = builder.subscribe()) {
        log.entry()
            .put("destination", topic)
            .put("subscription", subscription)
            .put("subType", subType)
            .put("consumer", name)
            .status("subscribed")
            .emit();

        int received = 0;
        int businessCommitted = 0;
        int negativeAcks = 0;
        long lastEventAt = System.currentTimeMillis();
        long startedAt = System.currentTimeMillis();
        while (true) {
          Message<byte[]> msg = consumer.receive(500, TimeUnit.MILLISECONDS);
          if (msg != null) {
            lastEventAt = System.currentTimeMillis();
            received++;
            Envelope envelope = Json.mapper().readValue(new String(msg.getData(), StandardCharsets.UTF_8), Envelope.class);
            int attempt = msg.getRedeliveryCount() + 1;
            String seq = msg.getProperty("seq");

            log.entry()
                .envelope(envelope)
                .put("destination", msg.getTopicName())
                .put("seq", seq == null ? "" : seq)
                .put("subscription", subscription)
                .put("consumer", name)
                .put("attempt", attempt)
                .put("redelivered", msg.getRedeliveryCount() > 0)
                .status("received")
                .emit();

            if (!failAggregate.isEmpty() && failAggregate.equals(envelope.getAggregateId())) {
              negativeAcks++;
              log.entry()
                  .envelope(envelope)
                  .put("destination", msg.getTopicName())
                  .put("subscription", subscription)
                  .put("consumer", name)
                  .put("attempt", attempt)
                  .status("redeliver_requested")
                  .emit();
              consumer.negativeAcknowledge(msg);
              continue;
            }

            if (noBusiness) {
              log.entry()
                  .envelope(envelope)
                  .put("destination", msg.getTopicName())
                  .put("subscription", subscription)
                  .put("consumer", name)
                  .put("attempt", attempt)
                  .status("inspected")
                  .emit();
              consumer.acknowledge(msg);
            } else {
              IdempotencyStore.Result result = store.process(envelope, IdempotencyStore.orderWriter());
              String status = result == IdempotencyStore.Result.PROCESSED ? "business_committed" : "duplicate_skipped";
              if (result == IdempotencyStore.Result.PROCESSED) {
                businessCommitted++;
              }
              log.entry()
                  .envelope(envelope)
                  .put("destination", msg.getTopicName())
                  .put("seq", seq == null ? "" : seq)
                  .put("subscription", subscription)
                  .put("consumer", name)
                  .put("attempt", attempt)
                  .status(status)
                  .emit();
              consumer.acknowledge(msg);
            }
          }
          if (expected >= 0 && (noBusiness ? received >= expected : businessCommitted >= expected)) break;
          if (idleExitMs > 0 && System.currentTimeMillis() - lastEventAt >= idleExitMs) break;
          if (totalExitMs > 0 && System.currentTimeMillis() - startedAt >= totalExitMs) break;
          if (System.currentTimeMillis() - startedAt > hardTimeoutMs) break;
        }
        log.entry()
            .put("destination", topic)
            .put("subscription", subscription)
            .put("consumer", name)
            .put("received", received)
            .put("businessCommitted", businessCommitted)
            .put("negativeAcks", negativeAcks)
            .status("done")
            .emit();
      }
    }
  }
}
