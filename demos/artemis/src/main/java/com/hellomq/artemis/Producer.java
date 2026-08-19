package com.hellomq.artemis;

import com.hellomq.shared.Envelope;
import com.hellomq.shared.Json;
import com.hellomq.shared.LabLogger;
import jakarta.jms.MessageProducer;
import jakarta.jms.Session;
import jakarta.jms.TextMessage;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * 生产者：JMS send 在 CORE 协议下阻塞至 Broker 确认（confirmation window），
 * 因此 status=confirmed 即"服务端已持久化"。--delay-ms 经 _AMQ_SCHED_DELAY 定时投递。
 */
public final class Producer {

  public static void run(Args args) throws Exception {
    String lab = args.get("lab", "unknown");
    String queueName = args.require("queue");
    Path fixturesDir = Path.of(args.get("fixtures", "demos/shared/fixtures"));
    List<String> files = List.of(args.require("files").split(","));
    long delayMs = args.getInt("delay-ms", 0);

    LabLogger log = LabLogger.of("producer", "artemis", lab, "order-service");
    try (var connection = Broker.connect();
        Session session = connection.createSession(false, Session.AUTO_ACKNOWLEDGE)) {
      var queue = session.createQueue(queueName);
      int seq = 0;
      try (MessageProducer producer = session.createProducer(queue)) {
        for (String file : files) {
          seq++;
          String body = Files.readString(fixturesDir.resolve(file));
          Envelope envelope = Json.mapper().readValue(body, Envelope.class);
          TextMessage message = session.createTextMessage(body);
          message.setStringProperty("seq", String.valueOf(seq));
          message.setLongProperty("sentAt", System.currentTimeMillis());
          if (delayMs > 0) {
            message.setLongProperty("_AMQ_SCHED_DELAY", delayMs);
          }

          long start = System.nanoTime();
          producer.send(message);
          log.entry()
              .envelope(envelope)
              .put("destination", queueName)
              .put("seq", seq)
              .put("brokerMessageId", message.getJMSMessageID())
              .duration(start)
              .status("confirmed")
              .emit();
        }
      }
      log.entry().put("destination", queueName).put("sent", seq).status("done").emit();
    }
  }
}
