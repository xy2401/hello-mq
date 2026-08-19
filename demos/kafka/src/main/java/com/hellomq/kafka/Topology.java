package com.hellomq.kafka;

import java.util.List;
import java.util.Properties;
import java.util.concurrent.ExecutionException;
import org.apache.kafka.clients.admin.AdminClient;
import org.apache.kafka.clients.admin.NewTopic;
import org.apache.kafka.common.errors.TopicExistsException;

/** 实验拓扑：所有 topic 显式创建（compose 关闭 auto.create.topics）。 */
public final class Topology {

  public static final String TOPIC_BASIC = "orders.basic";
  public static final String TOPIC_GROUP = "orders.group";
  public static final String TOPIC_ORDERING = "orders.ordering";
  public static final String TOPIC_TXN = "orders.txn";

  private Topology() {}

  public static void setup(String lab, String bootstrap) throws ExecutionException, InterruptedException {
    List<NewTopic> topics =
        switch (lab) {
          case "basic" -> List.of(new NewTopic(TOPIC_BASIC, 3, (short) 1));
          case "consumer-group" -> List.of(new NewTopic(TOPIC_GROUP, 3, (short) 1));
          case "ordering-replay" -> List.of(new NewTopic(TOPIC_ORDERING, 3, (short) 1));
          case "idempotence-transaction" -> List.of(new NewTopic(TOPIC_TXN, 3, (short) 1));
          default -> throw new IllegalArgumentException("unknown lab for setup: " + lab);
        };
    Properties props = new Properties();
    props.put("bootstrap.servers", bootstrap);
    try (AdminClient admin = AdminClient.create(props)) {
      try {
        admin.createTopics(topics).all().get();
      } catch (ExecutionException e) {
        if (!(e.getCause() instanceof TopicExistsException)) throw e;
      }
    }
  }
}
