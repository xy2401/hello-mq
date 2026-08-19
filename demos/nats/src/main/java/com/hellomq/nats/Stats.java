package com.hellomq.nats;

import com.hellomq.shared.LabLogger;
import io.nats.client.Connection;
import io.nats.client.JetStreamManagement;

/** Broker 状态探针：JetStream 消息数（ACK 不删除消息，保留策略决定删除时机）。 */
public final class Stats {

  public static void run(Args args) throws Exception {
    String lab = args.get("lab", "unknown");
    String stream = args.require("stream");
    LabLogger log = LabLogger.of("inspect", "nats", lab, "order-service");
    try (Connection nc = Broker.connect(Broker.DEFAULT_URL)) {
      JetStreamManagement jsm = nc.jetStreamManagement();
      long messages = jsm.getStreamInfo(stream).getStreamState().getMsgCount();
      log.entry()
          .put("stream", stream)
          .put("streamMessages", messages)
          .status("snapshot")
          .emit();
    }
  }
}
