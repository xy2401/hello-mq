package com.hellomq.activemqclassic;

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
 * 生产者：JMS send 对 PERSISTENT 消息阻塞至 Broker 确认，因此 status=confirmed 即“服务端已持久化”。
 * Classic 队列按需自动创建，无需预建拓扑。
 */
public final class Producer {

  public static void run(Args args) throws Exception {
    String lab = args.get("lab", "unknown");
    String queueName = args.require("queue");
    Path fixturesDir = Path.of(args.get("fixtures", "demos/shared/fixtures"));
    List<String> files = List.of(args.require("files").split(","));

    LabLogger log = LabLogger.of("producer", "activemq-classic", lab, "order-service");
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
