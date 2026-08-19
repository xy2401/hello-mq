package com.hellomq.nats;

import com.hellomq.shared.LabLogger;
import io.nats.client.Connection;
import io.nats.client.JetStreamManagement;
import io.nats.client.api.RetentionPolicy;
import io.nats.client.api.StorageType;
import io.nats.client.api.StreamConfiguration;

/**
 * 实验拓扑声明（规格 §9.4-5）。core-pubsub 无需任何声明——Core NATS 的 Subject
 * 不预注册、无持久化，这本身就是它和 JetStream 的关键语义差异（规格 §7.6）。
 */
public final class Topology {

  public static final String STREAM_ORDERS = "ORDERS";
  public static final String SUBJECT_ORDERS = "orders.events";

  private Topology() {}

  public static void setup(Args args) throws Exception {
    String lab = args.require("lab");
    LabLogger log = LabLogger.of("producer", "nats", lab, "order-service");
    switch (lab) {
      case "core-pubsub" -> log.entry().put("destination", "orders.core").status("noop").emit();
      case "jetstream-replay" -> {
        try (Connection nc = Broker.connect(Broker.DEFAULT_URL)) {
          JetStreamManagement jsm = nc.jetStreamManagement();
          jsm.addStream(
              StreamConfiguration.builder()
                  .name(STREAM_ORDERS)
                  .subjects(SUBJECT_ORDERS)
                  .storageType(StorageType.File)
                  .retentionPolicy(RetentionPolicy.Limits)
                  .build());
          log.entry().put("destination", SUBJECT_ORDERS).put("stream", STREAM_ORDERS).status("stream_created").emit();
        }
      }
      default -> throw new IllegalArgumentException("unknown lab for setup: " + lab);
    }
  }
}
