package com.hellomq.nats;

import com.hellomq.shared.Envelope;
import com.hellomq.shared.Json;
import com.hellomq.shared.LabLogger;
import io.nats.client.Connection;
import io.nats.client.JetStream;
import io.nats.client.api.PublishAck;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

/**
 * 生产者：两种模式刻意使用不同路径（规格 §7.6 禁止混写）。
 * --mode=core：Connection.publish，服务端无任何确认（易失）。
 * --mode=jetstream：JetStream.publish，服务端 PublishAck 才算确认。
 */
public final class Producer {

  public static void run(Args args) throws Exception {
    String lab = args.get("lab", "unknown");
    String subject = args.require("subject");
    String mode = args.require("mode");
    Path fixturesDir = Path.of(args.get("fixtures", "demos/shared/fixtures"));
    List<String> files = List.of(args.require("files").split(","));

    LabLogger log = LabLogger.of("producer", "nats", lab, "order-service");
    try (Connection nc = Broker.connect(Broker.DEFAULT_URL)) {
      JetStream js = mode.equals("jetstream") ? nc.jetStream() : null;
      int sent = 0;
      for (String file : files) {
        String body = Files.readString(fixturesDir.resolve(file));
        Envelope envelope = Json.mapper().readValue(body, Envelope.class);

        long start = System.nanoTime();
        if (mode.equals("jetstream")) {
          PublishAck ack = js.publish(subject, body.getBytes());
          log.entry()
              .envelope(envelope)
              .put("destination", subject)
              .put("seqno", ack.getSeqno())
              .duration(start)
              .status("confirmed")
              .emit();
        } else {
          nc.publish(subject, body.getBytes());
          log.entry()
              .envelope(envelope)
              .put("destination", subject)
              .duration(start)
              .status("published")
              .emit();
        }
        sent++;
      }
      nc.flush(Duration.ofSeconds(5));
      log.entry().put("destination", subject).put("sent", sent).status("done").emit();
    }
  }
}
