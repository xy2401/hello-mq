package com.hellomq.shared;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

final class EnvelopeTest {

  @Test
  void roundTripKeepsContractFields() throws Exception {
    String json =
        """
        {
          "messageId": "01JMQ000000000000000000001",
          "eventType": "order.created",
          "schemaVersion": 1,
          "occurredAt": "2026-01-01T00:00:00.000Z",
          "producer": "order-service",
          "traceId": "t1",
          "correlationId": "order-1001",
          "aggregateType": "order",
          "aggregateId": "order-1001",
          "contentType": "application/json",
          "payload": {"orderId": "order-1001", "customerId": "c1", "amount": 199.00, "currency": "CNY"}
        }
        """;
    Envelope env = Json.mapper().readValue(json, Envelope.class);
    assertEquals("01JMQ000000000000000000001", env.getMessageId());
    assertEquals("order.created", env.getEventType());
    assertEquals(1, env.getSchemaVersion());
    assertNotNull(env.getPayload());
    assertEquals("order-1001", env.getPayload().getOrderId());

    String out = Json.mapper().writeValueAsString(env);
    Envelope back = Json.mapper().readValue(out, Envelope.class);
    assertEquals(env.getMessageId(), back.getMessageId());
  }

  @Test
  void toleratesUnknownFieldsForCompatibleEvolution() throws Exception {
    String json =
        """
        {
          "messageId": "m1",
          "eventType": "order.created",
          "schemaVersion": 1,
          "futureField": {"anything": true},
          "payload": {"orderId": "o1", "customerId": "c1", "amount": 1, "currency": "CNY", "note": "new optional"}
        }
        """;
    Envelope env = Json.mapper().readValue(json, Envelope.class);
    assertEquals("m1", env.getMessageId());
    assertEquals("o1", env.getPayload().getOrderId(), "new optional field ignored by POJO but parse succeeds");
  }

  @Test
  void missingPayloadFieldsDeserializeToNull() throws Exception {
    String json = """
        {"messageId": "m2", "eventType": "order.created", "schemaVersion": 1, "payload": {"orderId": "o2"}}
        """;
    Envelope env = Json.mapper().readValue(json, Envelope.class);
    assertEquals("o2", env.getPayload().getOrderId());
    assertNull(env.getPayload().getCustomerId());
  }

  @Test
  void ulidIs26CharsAndUnique() {
    String a = Ulid.generate();
    String b = Ulid.generate();
    assertEquals(26, a.length());
    assertTrue(a.matches("[0-9A-HJKMNP-TV-Z]+"));
    assertTrue(!a.equals(b));
  }
}
