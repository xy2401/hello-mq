package com.hellomq.kafka;

import com.hellomq.shared.Envelope;
import com.hellomq.shared.Json;
import com.hellomq.shared.LabLogger;
import com.hellomq.shared.Ulid;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Properties;
import org.apache.kafka.clients.producer.KafkaProducer;
import org.apache.kafka.clients.producer.ProducerConfig;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.apache.kafka.clients.producer.RecordMetadata;
import org.apache.kafka.common.header.internals.RecordHeader;

/**
 * 生产者：acks=all + 幂等生产（规格 §7.2）。--repeat=N 时为每个副本生成新 messageId/traceId；
 * --txn=commit|abort 演示事务提交/中止两种可见性边界。
 */
public final class Producer {

  public static void run(Args args) throws Exception {
    String bootstrap = args.get("bootstrap", Broker.DEFAULT_BOOTSTRAP);
    String lab = args.get("lab", "unknown");
    String topic = args.require("topic");
    List<String> files = List.of(args.require("files").split(","));
    int repeat = args.getInt("repeat", 1);
    String keyOverride = args.get("key", null);
    String txn = args.get("txn", null);
    Path fixturesDir = Path.of(args.get("fixtures", "demos/shared/fixtures"));

    LabLogger log = LabLogger.of("producer", "kafka", lab, "order-service");
    Properties props = Broker.producerProps(bootstrap);
    if (txn != null) {
      props.put(ProducerConfig.TRANSACTIONAL_ID_CONFIG, "hello-mq-txn");
    }

    try (KafkaProducer<String, String> producer = new KafkaProducer<>(props)) {
      if (txn != null) {
        producer.initTransactions();
        producer.beginTransaction();
      }
      int seq = 0;
      int produced = 0;
      for (int r = 0; r < repeat; r++) {
        for (String file : files) {
          seq++;
          String raw = Files.readString(fixturesDir.resolve(file));
          Envelope envelope = Json.mapper().readValue(raw, Envelope.class);
          String body;
          if (repeat > 1) {
            envelope.setMessageId(Ulid.generate());
            envelope.setTraceId(randomTraceId());
            envelope.setOccurredAt(Instant.now().toString());
            body = Json.mapper().writeValueAsString(envelope);
          } else {
            body = raw;
          }
          String key = keyOverride != null ? keyOverride : envelope.getAggregateId();

          ProducerRecord<String, String> record = new ProducerRecord<>(topic, null, key, body);
          record.headers().add(new RecordHeader("traceId", envelope.getTraceId().getBytes()));
          record.headers().add(new RecordHeader("eventType", envelope.getEventType().getBytes()));
          record.headers().add(new RecordHeader("aggregateId", envelope.getAggregateId().getBytes()));
          record.headers().add(new RecordHeader("seq", String.valueOf(seq).getBytes()));

          long start = System.nanoTime();
          RecordMetadata metadata = producer.send(record).get();
          log.entry()
              .envelope(envelope)
              .put("destination", topic)
              .put("partitionOrQueue", String.valueOf(metadata.partition()))
              .put("offset", metadata.offset())
              .put("seq", seq)
              .duration(start)
              .status("produced")
              .emit();
          produced++;
        }
      }
      if (txn != null) {
        if ("abort".equals(txn)) {
          producer.abortTransaction();
          log.entry().put("destination", topic).put("produced", produced).status("txn_aborted").emit();
        } else {
          producer.commitTransaction();
          log.entry().put("destination", topic).put("produced", produced).status("txn_committed").emit();
        }
      } else {
        log.entry().put("destination", topic).put("produced", produced).status("done").emit();
      }
    }
  }

  private static String randomTraceId() {
    java.util.random.RandomGenerator random = java.util.random.RandomGenerator.getDefault();
    StringBuilder sb = new StringBuilder(32);
    for (int i = 0; i < 32; i++) {
      sb.append("0123456789abcdef".charAt(random.nextInt(16)));
    }
    return sb.toString();
  }
}
