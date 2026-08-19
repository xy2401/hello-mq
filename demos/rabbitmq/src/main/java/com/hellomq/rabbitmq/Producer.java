package com.hellomq.rabbitmq;

import com.hellomq.shared.Envelope;
import com.hellomq.shared.Json;
import com.hellomq.shared.LabLogger;
import com.rabbitmq.client.AMQP;
import com.rabbitmq.client.Channel;
import com.rabbitmq.client.Connection;
import com.rabbitmq.client.MessageProperties;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 生产者：Publisher Confirms 逐条确认（规格 §7.1）。消息体为 fixture 原始 JSON，
 * 头部携带 messageId/correlationId 与 traceId 等契约字段。
 */
public final class Producer {

  public static void run(Args args) throws Exception {
    String uri = args.get("uri", Broker.DEFAULT_URI);
    String lab = args.get("lab", "unknown");
    Path fixturesDir = Path.of(args.get("fixtures", "demos/shared/fixtures"));
    List<String> files = List.of(args.require("files").split(","));
    List<String> routingKeys =
        args.has("routing-keys") ? List.of(args.require("routing-keys").split(",")) : null;
    String queue = args.get("queue", null);
    String exchange = args.get("exchange", null);
    int repeat = args.getInt("repeat", 1);
    if (queue == null && exchange == null) {
      throw new IllegalArgumentException("produce requires --queue or --exchange");
    }
    if (routingKeys != null && routingKeys.size() != files.size()) {
      throw new IllegalArgumentException("--routing-keys count must match --files count");
    }

    LabLogger log = LabLogger.of("producer", "rabbitmq", lab, "order-service");
    try (Connection connection = Broker.connect(uri);
        Channel channel = connection.createChannel()) {
      channel.confirmSelect();
      if (queue != null) {
        channel.queueDeclarePassive(queue);
      } else {
        channel.exchangeDeclarePassive(exchange);
      }

      int confirmed = 0;
      for (int round = 0; round < repeat; round++) {
        for (int i = 0; i < files.size(); i++) {
          String body = Files.readString(fixturesDir.resolve(files.get(i)));
          Envelope envelope = Json.mapper().readValue(body, Envelope.class);
          if (repeat > 1) {
            // 多轮发送时为每条消息生成新的幂等键，避免被消费端幂等表误判为重复
            envelope.setMessageId(com.hellomq.shared.Ulid.generate());
            envelope.setOccurredAt(java.time.Instant.now().toString());
            body = Json.mapper().writeValueAsString(envelope);
          }
          String routingKey = routingKeys != null ? routingKeys.get(i) : (queue != null ? queue : "");
          String destination = queue != null ? queue : exchange;

          Map<String, Object> headers = new HashMap<>();
          headers.put("traceId", envelope.getTraceId());
          headers.put("eventType", envelope.getEventType());
          headers.put("aggregateId", envelope.getAggregateId());
          AMQP.BasicProperties properties =
              new AMQP.BasicProperties.Builder()
                  .deliveryMode(MessageProperties.PERSISTENT_TEXT_PLAIN.getDeliveryMode())
                  .contentType("application/json")
                  .messageId(envelope.getMessageId())
                  .correlationId(envelope.getCorrelationId())
                  .type(envelope.getEventType())
                  .headers(headers)
                  .build();

          long start = System.nanoTime();
          channel.basicPublish(exchange != null ? exchange : "", routingKey, properties, body.getBytes());
          if (!channel.waitForConfirms(5000)) {
            log.entry().envelope(envelope).put("destination", destination).status("confirm_timeout").emit();
            System.exit(1);
          }
          log.entry()
              .envelope(envelope)
              .put("destination", destination)
              .put("routingKey", routingKey)
              .duration(start)
              .status("confirmed")
              .emit();
          confirmed++;
        }
      }
      log.entry().put("destination", queue != null ? queue : exchange).put("confirmed", confirmed).status("done").emit();
    }
  }
}
