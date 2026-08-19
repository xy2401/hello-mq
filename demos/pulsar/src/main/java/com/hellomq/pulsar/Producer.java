package com.hellomq.pulsar;

import com.hellomq.shared.Envelope;
import com.hellomq.shared.Json;
import com.hellomq.shared.LabLogger;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import org.apache.pulsar.client.api.MessageId;
import org.apache.pulsar.client.api.PulsarClient;

/**
 * 生产者：关闭 batching 保证逐条顺序可见；key 默认取 aggregateId（Key_Shared 实验依赖它）。
 */
public final class Producer {

  public static void run(Args args) throws Exception {
    String serviceUrl = args.get("service-url", "pulsar://127.0.0.1:6650");
    String lab = args.get("lab", "unknown");
    String topic = args.require("topic");
    List<String> files = List.of(args.require("files").split(","));
    int repeat = args.getInt("repeat", 1);
    Path fixturesDir = Path.of(args.get("fixtures", "demos/shared/fixtures"));

    LabLogger log = LabLogger.of("producer", "pulsar", lab, "order-service");
    try (PulsarClient client = PulsarClient.builder().serviceUrl(serviceUrl).build();
        var producer = client.newProducer().topic(topic).enableBatching(false).create()) {
      int seq = 0;
      for (int r = 0; r < repeat; r++) {
        for (String file : files) {
          seq++;
          String raw = Files.readString(fixturesDir.resolve(file));
          Envelope envelope = Json.mapper().readValue(raw, Envelope.class);
          String body;
          if (repeat > 1) {
            envelope.setMessageId(com.hellomq.shared.Ulid.generate());
            envelope.setOccurredAt(java.time.Instant.now().toString());
            body = Json.mapper().writeValueAsString(envelope);
          } else {
            body = raw;
          }
          long start = System.nanoTime();
          MessageId messageId =
              producer
                  .newMessage()
                  .key(envelope.getAggregateId())
                  .property("messageId", envelope.getMessageId())
                  .property("traceId", envelope.getTraceId())
                  .property("eventType", envelope.getEventType())
                  .property("aggregateId", envelope.getAggregateId())
                  .property("seq", String.valueOf(seq))
                  .value(body.getBytes(java.nio.charset.StandardCharsets.UTF_8))
                  .send();
          log.entry()
              .envelope(envelope)
              .put("destination", topic)
              .put("partitionOrQueue", "0")
              .put("brokerMessageId", messageId.toString())
              .put("seq", seq)
              .duration(start)
              .status("produced")
              .emit();
        }
      }
      log.entry().put("destination", topic).put("produced", seq).status("done").emit();
    }
  }
}
