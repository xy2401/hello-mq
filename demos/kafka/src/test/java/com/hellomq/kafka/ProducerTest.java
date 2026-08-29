package com.hellomq.kafka;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class ProducerTest {

  @Test
  void randomTraceIdUsesThirtyTwoLowercaseHexCharacters() {
    assertTrue(Producer.randomTraceId().matches("[0-9a-f]{32}"));
  }
}
