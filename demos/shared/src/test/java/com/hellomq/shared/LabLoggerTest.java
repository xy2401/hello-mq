package com.hellomq.shared;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import org.junit.jupiter.api.Test;

final class LabLoggerTest {

  @Test
  void emitsFixedKeyOrder() {
    PrintStream original = System.out;
    ByteArrayOutputStream buf = new ByteArrayOutputStream();
    System.setOut(new PrintStream(buf));
    try {
      LabLogger log = LabLogger.of("consumer", "rabbitmq", "basic", "order-service");
      Envelope env = new Envelope();
      env.setMessageId("m-1");
      env.setEventType("order.created");
      env.setSchemaVersion(1);
      env.setAggregateId("order-1");
      env.setTraceId("t-1");
      env.setCorrelationId("order-1");
      log.entry()
          .envelope(env)
          .put("destination", "orders.basic")
          .put("attempt", 1)
          .put("redelivered", false)
          .status("business_committed")
          .emit();
    } finally {
      System.setOut(original);
    }
    String line = buf.toString().trim();
    assertTrue(line.startsWith("[consumer] timestamp="), line);
    assertTrue(
        line.indexOf("messageId=") < line.indexOf("eventType=")
            && line.indexOf("eventType=") < line.indexOf("aggregateId=")
            && line.indexOf("aggregateId=") < line.indexOf("traceId=")
            && line.indexOf("traceId=") < line.indexOf("destination=")
            && line.indexOf("destination=") < line.indexOf("attempt=")
            && line.indexOf("attempt=") < line.indexOf("redelivered=")
            && line.indexOf("redelivered=") < line.indexOf("status="),
        line);
    assertTrue(line.contains("product=rabbitmq"), line);
    assertTrue(line.contains("lab=basic"), line);
  }
}
