package com.hellomq.rabbitmq;

import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import java.util.HashMap;
import java.util.Map;

/** 实验拓扑声明（规格 §9.4-5）。所有队列 durable；DLX 回环见 retry-dlq。 */
public final class Topology {

  public static final String QUEUE_BASIC = "orders.basic";
  public static final String QUEUE_CRASH = "orders.crash";
  public static final String EXCHANGE_ROUTING = "orders.events";
  public static final String QUEUE_ROUTING_CREATED = "orders.routing.created";
  public static final String QUEUE_ROUTING_ALL = "orders.routing.all";
  public static final String QUEUE_ROUTING_EU = "orders.routing.eu";
  public static final String QUEUE_WORK = "orders.work";
  public static final String QUEUE_RETRY = "orders.retry";
  public static final String QUEUE_DLQ = "orders.dlq";
  public static final String QUEUE_BACKLOG = "orders.backlog";

  private Topology() {}

  public static void setup(String lab, Connection connection) throws Exception {
    try (Channel channel = connection.createChannel()) {
      switch (lab) {
        case "basic" -> channel.queueDeclare(QUEUE_BASIC, true, false, false, null);
        case "consumer-crash" -> channel.queueDeclare(QUEUE_CRASH, true, false, false, null);
        case "backlog-recovery" -> channel.queueDeclare(QUEUE_BACKLOG, true, false, false, null);
        case "routing" -> {
          channel.exchangeDeclare(EXCHANGE_ROUTING, "topic", true);
          channel.queueDeclare(QUEUE_ROUTING_CREATED, true, false, false, null);
          channel.queueDeclare(QUEUE_ROUTING_ALL, true, false, false, null);
          channel.queueDeclare(QUEUE_ROUTING_EU, true, false, false, null);
          channel.queueBind(QUEUE_ROUTING_CREATED, EXCHANGE_ROUTING, "order.created");
          channel.queueBind(QUEUE_ROUTING_ALL, EXCHANGE_ROUTING, "order.#");
          channel.queueBind(QUEUE_ROUTING_EU, EXCHANGE_ROUTING, "order.created.eu");
        }
        case "retry-dlq" -> {
          Map<String, Object> workArgs = new HashMap<>();
          workArgs.put("x-dead-letter-exchange", "");
          workArgs.put("x-dead-letter-routing-key", QUEUE_RETRY);
          channel.queueDeclare(QUEUE_WORK, true, false, false, workArgs);

          Map<String, Object> retryArgs = new HashMap<>();
          retryArgs.put("x-message-ttl", 1000);
          retryArgs.put("x-dead-letter-exchange", "");
          retryArgs.put("x-dead-letter-routing-key", QUEUE_WORK);
          channel.queueDeclare(QUEUE_RETRY, true, false, false, retryArgs);

          channel.queueDeclare(QUEUE_DLQ, true, false, false, null);
        }
        default -> throw new IllegalArgumentException("unknown lab for setup: " + lab);
      }
    }
  }
}
