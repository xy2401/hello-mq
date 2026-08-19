package com.hellomq.rocketmq;

import com.hellomq.shared.Envelope;
import com.hellomq.shared.Json;
import com.hellomq.shared.LabLogger;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.rocketmq.client.apis.ClientConfiguration;
import org.apache.rocketmq.client.apis.ClientServiceProvider;
import org.apache.rocketmq.client.apis.message.Message;
import org.apache.rocketmq.client.apis.producer.ProducerBuilder;
import org.apache.rocketmq.client.apis.producer.SendReceipt;
import org.apache.rocketmq.client.apis.producer.Transaction;
import org.apache.rocketmq.client.apis.producer.TransactionResolution;

/**
 * 生产者：5.x gRPC 客户端经 proxy 发送。--group 设置 FIFO MessageGroup；--delay-ms 设置定时投递；
 * --txn=commit-after-unknown 发送 Half Message 并等待 Broker 回查（首查 UNKNOWN，之后 COMMIT）。
 */
public final class Producer {

  public static void run(Args args) throws Exception {
    String endpoints = args.get("endpoints", "127.0.0.1:8081");
    String lab = args.get("lab", "unknown");
    String topic = args.require("topic");
    List<String> files = List.of(args.require("files").split(","));
    String messageGroup = args.get("group", null);
    long delayMs = args.getInt("delay-ms", 0);
    String txn = args.get("txn", null);
    Path fixturesDir = Path.of(args.get("fixtures", "demos/shared/fixtures"));

    LabLogger log = LabLogger.of("producer", "rocketmq", lab, "order-service");
    ClientServiceProvider provider = ClientServiceProvider.loadService();
    ClientConfiguration config =
        ClientConfiguration.newBuilder().setEndpoints(endpoints).setRequestTimeout(Duration.ofSeconds(10)).build();

    AtomicInteger checkBacks = new AtomicInteger();
    CountDownLatch resolved = new CountDownLatch(1);
    ProducerBuilder builder = provider.newProducerBuilder().setClientConfiguration(config).setTopics(topic);
    if (txn != null) {
      builder.setTransactionChecker(
          (view) -> {
            int n = checkBacks.incrementAndGet();
            log.entry()
                .put("destination", topic)
                .put("checkBack", n)
                .status("txn_check")
                .emit();
            if (n >= 2) {
              resolved.countDown();
              return TransactionResolution.COMMIT;
            }
            return TransactionResolution.UNKNOWN;
          });
    }

    try (var producer = builder.build()) {
      int seq = 0;
      Transaction transaction = txn != null ? producer.beginTransaction() : null;
      for (String file : files) {
        seq++;
        String raw = Files.readString(fixturesDir.resolve(file));
        Envelope envelope = Json.mapper().readValue(raw, Envelope.class);
        var msgBuilder =
            provider
                .newMessageBuilder()
                .setTopic(topic)
                .setKeys(envelope.getMessageId())
                .setTag(envelope.getEventType())
                .addProperty("messageId", envelope.getMessageId())
                .addProperty("traceId", envelope.getTraceId())
                .addProperty("eventType", envelope.getEventType())
                .addProperty("aggregateId", envelope.getAggregateId())
                .addProperty("seq", String.valueOf(seq))
                .addProperty("sentAt", String.valueOf(System.currentTimeMillis()))
                .setBody(raw.getBytes(StandardCharsets.UTF_8));
        if (messageGroup != null) {
          msgBuilder.setMessageGroup(messageGroup);
        }
        if (delayMs > 0) {
          msgBuilder.setDeliveryTimestamp(System.currentTimeMillis() + delayMs);
        }
        Message message = msgBuilder.build();

        long start = System.nanoTime();
        SendReceipt receipt = transaction != null ? producer.send(message, transaction) : producer.send(message);
        var entry =
            log.entry()
                .envelope(envelope)
                .put("destination", topic)
                .put("seq", seq)
                .put("brokerMessageId", receipt.getMessageId().toString())
                .duration(start);
        if (messageGroup != null) {
          entry.put("messageGroup", messageGroup);
        }
        if (delayMs > 0) {
          entry.put("requestedDelayMs", delayMs);
        }
        entry.status(txn != null ? "half_sent" : "produced").emit();
      }

      if (txn != null) {
        // 不在本地 commit/rollback：交给 Broker 回查决定（首查 UNKNOWN → 第二次 COMMIT）。
        boolean done = resolved.await(40, TimeUnit.SECONDS);
        log.entry()
            .put("destination", topic)
            .put("checkBacks", checkBacks.get())
            .put("resolved", done)
            .status("txn_resolved")
            .emit();
        if (!done) {
          System.err.println("transaction check-back did not resolve within 40s");
          System.exit(1);
        }
      } else {
        log.entry().put("destination", topic).put("produced", seq).status("done").emit();
      }
    }
  }
}
