package com.hellomq.kafka;

import com.hellomq.shared.Envelope;
import com.hellomq.shared.IdempotencyStore;
import com.hellomq.shared.Json;
import com.hellomq.shared.LabLogger;
import com.hellomq.shared.ReplayGate;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Timer;
import java.util.TimerTask;
import java.util.stream.Collectors;
import org.apache.kafka.clients.consumer.ConsumerRebalanceListener;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.apache.kafka.clients.consumer.KafkaConsumer;
import org.apache.kafka.common.TopicPartition;
import org.apache.kafka.common.header.Header;

/**
 * 消费者：手动提交 offset（处理 + 落库提交后才 commitSync，规格 §5.4 崩溃窗口同样适用）。
 * --expected=N 收满退出；--idle-exit-ms=N 空闲超时退出（用于不确定分配的 consumer-group 实验）。
 */
public final class Consumer {

  public static void run(Args args) throws Exception {
    String bootstrap = args.get("bootstrap", Broker.DEFAULT_BOOTSTRAP);
    String lab = args.get("lab", "unknown");
    String topic = args.require("topic");
    String group = args.require("group");
    String dbPath = args.require("db");
    String name = args.get("consumer", "consumer-1");
    int expected = args.getInt("expected", -1);
    long idleExitMs = args.getInt("idle-exit-ms", -1);
    String isolation = args.get("isolation", "read_uncommitted");
    String autoOffsetReset = args.get("auto-offset-reset", "earliest");

    LabLogger log = LabLogger.of("consumer", "kafka", lab, "order-service");
    try (IdempotencyStore store = new IdempotencyStore(dbPath, lab);
        KafkaConsumer<String, String> consumer =
            new KafkaConsumer<>(Broker.consumerProps(bootstrap, group, isolation, autoOffsetReset))) {

      Timer watchdog = new Timer(true);
      watchdog.schedule(
          new TimerTask() {
            @Override
            public void run() {
              log.entry().put("destination", topic).status("timeout").emit();
              System.exit(1);
            }
          },
          120_000);

      consumer.subscribe(
          java.util.List.of(topic),
          new ConsumerRebalanceListener() {
            @Override
            public void onPartitionsRevoked(java.util.Collection<TopicPartition> partitions) {}

            @Override
            public void onPartitionsAssigned(java.util.Collection<TopicPartition> partitions) {
              String assigned =
                  partitions.stream()
                      .map((p) -> String.valueOf(p.partition()))
                      .sorted()
                      .collect(Collectors.joining(","));
              log.entry()
                  .put("destination", topic)
                  .put("consumerGroup", group)
                  .put("consumer", name)
                  .put("partitions", assigned)
                  .status("assigned")
                  .emit();
            }
          });

      int received = 0;
      long lastCompletedAt = System.currentTimeMillis();
      long startedAt = System.currentTimeMillis();
      while (true) {
        var records = consumer.poll(Duration.ofMillis(500));
        for (ConsumerRecord<String, String> record : records) {
          received++;
          Envelope envelope = Json.mapper().readValue(record.value(), Envelope.class);
          String seq = header(record, "seq");

          log.entry()
              .envelope(envelope)
              .put("destination", topic)
              .put("partitionOrQueue", String.valueOf(record.partition()))
              .put("offset", record.offset())
              .put("seq", seq)
              .put("consumerGroup", group)
              .put("consumer", name)
              .put("attempt", "1")
              .put("redelivered", false)
              .status("received")
              .emit();
          ReplayGate.awaitCheckpoint("after-delivery", envelope.getMessageId());

          IdempotencyStore.Result result = store.process(envelope, IdempotencyStore.orderWriter());
          String status = result == IdempotencyStore.Result.PROCESSED ? "business_committed" : "duplicate_skipped";
          log.entry()
              .envelope(envelope)
              .put("destination", topic)
              .put("partitionOrQueue", String.valueOf(record.partition()))
              .put("seq", seq)
              .put("consumerGroup", group)
              .put("attempt", "1")
              .status(status)
              .emit();
          ReplayGate.awaitCheckpoint("before-offset-commit", envelope.getMessageId());
          consumer.commitSync();
          // 回放门闩会有意暂停处理。空闲时间必须从本条消息完成后计算，
          // 否则门闩等待本身会被误判为“无消息空闲”，导致仍有 lag 时提前退出。
          lastCompletedAt = System.currentTimeMillis();
        }
        if (expected >= 0 && received >= expected) break;
        if (idleExpired(received, lastCompletedAt, System.currentTimeMillis(), idleExitMs)) break;
        if (System.currentTimeMillis() - startedAt > 110_000) break;
      }
      watchdog.cancel();
      log.entry().put("destination", topic).put("consumer", name).put("received", received).status("done").emit();
    }
  }

  static boolean idleExpired(int received, long lastCompletedAt, long now, long idleExitMs) {
    return idleExitMs > 0 && received > 0 && now - lastCompletedAt >= idleExitMs;
  }

  private static String header(ConsumerRecord<String, String> record, String key) {
    Header header = record.headers().lastHeader(key);
    return header == null ? "" : new String(header.value(), StandardCharsets.UTF_8);
  }
}
