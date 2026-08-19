package com.hellomq.shared;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

final class IdempotencyStoreTest {

  private Envelope envelope(String messageId, String orderId) {
    Envelope env = new Envelope();
    env.setMessageId(messageId);
    env.setEventType("order.created");
    env.setSchemaVersion(1);
    env.setAggregateId(orderId);
    Envelope.OrderCreatedPayload payload = new Envelope.OrderCreatedPayload();
    payload.setOrderId(orderId);
    payload.setCustomerId("customer-1");
    payload.setAmount(new java.math.BigDecimal("10.50"));
    payload.setCurrency("CNY");
    env.setPayload(payload);
    return env;
  }

  @Test
  void duplicateIsSkippedAndBusinessAppliedOnce(@TempDir Path tmp) throws Exception {
    Path db = tmp.resolve("idem.db");
    try (IdempotencyStore store = new IdempotencyStore(db.toString(), "unit")) {
      Envelope env = envelope("m-1", "order-1");
      assertEquals(IdempotencyStore.Result.PROCESSED, store.process(env, IdempotencyStore.orderWriter()));
      assertEquals(IdempotencyStore.Result.DUPLICATE_SKIPPED, store.process(env, IdempotencyStore.orderWriter()));
      assertEquals(1, store.businessRowCount());
      assertEquals(1, store.processedCount());
    }
  }

  @Test
  void poisonPayloadFailsAndLeavesNoBusinessRow(@TempDir Path tmp) throws Exception {
    Path db = tmp.resolve("idem.db");
    try (IdempotencyStore store = new IdempotencyStore(db.toString(), "unit")) {
      Envelope poison = envelope("m-2", "order-2");
      poison.getPayload().setCustomerId(null);
      assertThrows(RuntimeException.class, () -> store.process(poison, IdempotencyStore.orderWriter()));
      assertEquals(0, store.businessRowCount());
      assertEquals(0, store.processedCount());
    }
  }

  @Test
  void statePersistsAcrossReopen(@TempDir Path tmp) throws Exception {
    Path db = tmp.resolve("idem.db");
    Envelope env = envelope("m-3", "order-3");
    try (IdempotencyStore store = new IdempotencyStore(db.toString(), "unit")) {
      assertEquals(IdempotencyStore.Result.PROCESSED, store.process(env, IdempotencyStore.orderWriter()));
    }
    try (IdempotencyStore reopened = new IdempotencyStore(db.toString(), "unit")) {
      assertEquals(IdempotencyStore.Result.DUPLICATE_SKIPPED, reopened.process(env, IdempotencyStore.orderWriter()));
      assertEquals(1, reopened.businessRowCount());
    }
  }

  @Test
  void fixturesLoadFromSharedDirectory() throws Exception {
    Path dir = Path.of("demos/shared/fixtures");
    if (!Files.isDirectory(dir)) {
      dir = Path.of("../shared/fixtures");
    }
    var orders = IdempotencyStore.orderFixtures(dir);
    assertEquals(3, orders.size());
    Envelope poison = IdempotencyStore.loadEnvelope(dir.resolve("poison-message.json"));
    assertEquals("order-poison", poison.getPayload().getOrderId());
    assertEquals(null, poison.getPayload().getCustomerId());
  }
}
