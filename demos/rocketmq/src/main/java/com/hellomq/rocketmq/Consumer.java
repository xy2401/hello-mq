package com.hellomq.rocketmq;

import com.hellomq.shared.Envelope;
import com.hellomq.shared.IdempotencyStore;
import com.hellomq.shared.Json;
import com.hellomq.shared.LabLogger;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.rocketmq.client.apis.ClientConfiguration;
import org.apache.rocketmq.client.apis.ClientServiceProvider;
import org.apache.rocketmq.client.apis.consumer.ConsumeResult;
import org.apache.rocketmq.client.apis.consumer.FilterExpression;
import org.apache.rocketmq.client.apis.message.MessageView;

/**
 * 消费者：两种模式。
 * simple：SimpleConsumer 主动拉取，业务事务提交后才 ack（§5.4 崩溃窗口同样适用）。
 * push：PushConsumer 监听器消费；--fail-aggregate 命中的消息返回 FAILURE，由 Broker 按
 * maxAttempts 重试并在耗尽后转入 %DLQ% 组 Topic（retry-dlq 实验）。
 */
public final class Consumer {

  public static void run(Args args) throws Exception {
    String mode = args.get("mode", "simple");
    if ("push".equals(mode)) {
      runPush(args);
    } else {
      runSimple(args);
    }
  }

  private static void runSimple(Args args) throws Exception {
    String endpoints = args.get("endpoints", "127.0.0.1:8081");
    String lab = args.get("lab", "unknown");
    String topic = args.require("topic");
    String group = args.require("group");
    String dbPath = args.require("db");
    String name = args.get("consumer", "consumer-1");
    int expected = args.getInt("expected", -1);
    long idleExitMs = args.getInt("idle-exit-ms", -1);
    long hardTimeoutMs = args.getInt("hard-timeout-ms", 110_000);

    LabLogger log = LabLogger.of("consumer", "rocketmq", lab, "order-service");
    ClientServiceProvider provider = ClientServiceProvider.loadService();
    ClientConfiguration config =
        ClientConfiguration.newBuilder().setEndpoints(endpoints).setRequestTimeout(Duration.ofSeconds(10)).build();

    try (IdempotencyStore store = new IdempotencyStore(dbPath, lab);
        var consumer =
            provider
                .newSimpleConsumerBuilder()
                .setConsumerGroup(group)
                .setClientConfiguration(config)
                .setSubscriptionExpressions(Map.of(topic, FilterExpression.SUB_ALL))
                .setAwaitDuration(Duration.ofSeconds(3))
                .build()) {

      int received = 0;
      long lastMessageAt = System.currentTimeMillis();
      long startedAt = System.currentTimeMillis();
      while (true) {
        List<MessageView> views = consumer.receive(8, Duration.ofSeconds(30));
        for (MessageView view : views) {
          lastMessageAt = System.currentTimeMillis();
          received++;
          Map<String, String> props = view.getProperties();
          Envelope envelope =
              Json.mapper()
                  .readValue(StandardCharsets.UTF_8.decode(view.getBody()).toString(), Envelope.class);

          var entry =
              log.entry()
                  .envelope(envelope)
                  .put("destination", view.getTopic())
                  .put("seq", props.getOrDefault("seq", ""))
                  .put("consumerGroup", group)
                  .put("consumer", name)
                  .put("attempt", view.getDeliveryAttempt())
                  .put("redelivered", view.getDeliveryAttempt() > 1);
          view.getMessageGroup().ifPresent((g) -> entry.put("messageGroup", g));
          String sentAt = props.get("sentAt");
          if (sentAt != null) {
            entry.put("deliveryDelayMs", System.currentTimeMillis() - Long.parseLong(sentAt));
          }
          entry.status("received").emit();

          String status;
          if (args.has("no-business")) {
            status = "inspected";
          } else {
            IdempotencyStore.Result result = store.process(envelope, IdempotencyStore.orderWriter());
            status = result == IdempotencyStore.Result.PROCESSED ? "business_committed" : "duplicate_skipped";
          }
          log.entry()
              .envelope(envelope)
              .put("destination", view.getTopic())
              .put("seq", props.getOrDefault("seq", ""))
              .put("consumerGroup", group)
              .put("attempt", view.getDeliveryAttempt())
              .status(status)
              .emit();
          consumer.ack(view);
        }
        if (expected >= 0 && received >= expected) break;
        if (idleExitMs > 0 && received > 0 && System.currentTimeMillis() - lastMessageAt >= idleExitMs) break;
        if (System.currentTimeMillis() - startedAt > hardTimeoutMs) break;
      }
      log.entry().put("destination", topic).put("consumer", name).put("received", received).status("done").emit();
    }
  }

  private static void runPush(Args args) throws Exception {
    String endpoints = args.get("endpoints", "127.0.0.1:8081");
    String lab = args.get("lab", "unknown");
    String topic = args.require("topic");
    String group = args.require("group");
    String dbPath = args.require("db");
    String name = args.get("consumer", "consumer-1");
    int expectedOk = args.getInt("expected", 1);
    String failAggregate = args.get("fail-aggregate", "");
    int maxAttempts = args.getInt("max-attempts", 2);

    LabLogger log = LabLogger.of("consumer", "rocketmq", lab, "order-service");
    ClientServiceProvider provider = ClientServiceProvider.loadService();
    ClientConfiguration config =
        ClientConfiguration.newBuilder().setEndpoints(endpoints).setRequestTimeout(Duration.ofSeconds(10)).build();

    AtomicInteger okReceived = new AtomicInteger();
    Map<String, Integer> failedAttempts = new ConcurrentHashMap<>();

    try (IdempotencyStore store = new IdempotencyStore(dbPath, lab);
        var consumer =
            provider
                .newPushConsumerBuilder()
                .setConsumerGroup(group)
                .setClientConfiguration(config)
                .setSubscriptionExpressions(Map.of(topic, FilterExpression.SUB_ALL))
                .setConsumptionThreadCount(1)
                .setMessageListener(
                    (view) -> {
                      Map<String, String> props = view.getProperties();
                      try {
                        Envelope envelope =
                            Json.mapper()
                                .readValue(
                                    StandardCharsets.UTF_8.decode(view.getBody()).toString(), Envelope.class);
                        int attempt = view.getDeliveryAttempt();
                        if (!failAggregate.isEmpty() && failAggregate.equals(envelope.getAggregateId())) {
                          failedAttempts.compute(envelope.getMessageId(), (k, v) -> Math.max(v == null ? 0 : v, attempt));
                          log.entry()
                              .envelope(envelope)
                              .put("destination", view.getTopic())
                              .put("consumerGroup", group)
                              .put("consumer", name)
                              .put("attempt", attempt)
                              .status("consume_failed")
                              .emit();
                          return ConsumeResult.FAILURE;
                        }
                        log.entry()
                            .envelope(envelope)
                            .put("destination", view.getTopic())
                            .put("seq", props.getOrDefault("seq", ""))
                            .put("consumerGroup", group)
                            .put("consumer", name)
                            .put("attempt", attempt)
                            .put("redelivered", attempt > 1)
                            .status("received")
                            .emit();
                        IdempotencyStore.Result result = store.process(envelope, IdempotencyStore.orderWriter());
                        String status =
                            result == IdempotencyStore.Result.PROCESSED ? "business_committed" : "duplicate_skipped";
                        log.entry()
                            .envelope(envelope)
                            .put("destination", view.getTopic())
                            .put("consumerGroup", group)
                            .put("attempt", attempt)
                            .status(status)
                            .emit();
                        okReceived.incrementAndGet();
                        return ConsumeResult.SUCCESS;
                      } catch (Exception e) {
                        log.entry()
                            .put("destination", view.getTopic())
                            .put("error", e.getClass().getSimpleName())
                            .status("consume_failed")
                            .emit();
                        return ConsumeResult.FAILURE;
                      }
                    })
                .build()) {

      long startedAt = System.currentTimeMillis();
      while (System.currentTimeMillis() - startedAt < 90_000) {
        boolean poisonDone =
            failAggregate.isEmpty()
                || failedAttempts.values().stream().anyMatch((a) -> a >= maxAttempts);
        if (okReceived.get() >= expectedOk && poisonDone) break;
        Thread.sleep(500);
      }
      log.entry()
          .put("destination", topic)
          .put("consumer", name)
          .put("received", okReceived.get())
          .put("poisonMaxAttempt", failedAttempts.values().stream().mapToInt(Integer::intValue).max().orElse(0))
          .status("done")
          .emit();
    }
  }
}
