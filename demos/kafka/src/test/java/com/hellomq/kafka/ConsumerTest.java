package com.hellomq.kafka;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

final class ConsumerTest {

  @Test
  void idleTimeoutStartsAfterCompletedProcessing() {
    assertFalse(Consumer.idleExpired(0, 1_000, 20_000, 8_000));
    assertFalse(Consumer.idleExpired(1, 15_000, 20_000, 8_000));
    assertTrue(Consumer.idleExpired(1, 12_000, 20_000, 8_000));
  }
}
