package com.hellomq.activemqclassic;

import com.hellomq.shared.LabLogger;
import jakarta.jms.QueueBrowser;
import jakarta.jms.Session;
import java.util.Enumeration;

/** Broker 状态探针：QueueBrowser 清点队列深度（commit 即删除，深度=未消费的消息数）。 */
public final class Stats {

  public static void run(Args args) throws Exception {
    String lab = args.get("lab", "unknown");
    String queueName = args.require("queue");
    LabLogger log = LabLogger.of("inspect", "activemq-classic", lab, "order-service");
    try (var connection = Broker.connect();
        Session session = connection.createSession(false, Session.AUTO_ACKNOWLEDGE)) {
      var queue = session.createQueue(queueName);
      long depth = 0;
      try (QueueBrowser browser = session.createBrowser(queue)) {
        Enumeration<?> e = browser.getEnumeration();
        while (e.hasMoreElements()) {
          e.nextElement();
          depth++;
        }
      }
      log.entry().put("queue", queueName).put("queueDepth", depth).status("snapshot").emit();
    }
  }
}
