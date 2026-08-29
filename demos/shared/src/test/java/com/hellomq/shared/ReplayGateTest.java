package com.hellomq.shared;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import org.junit.jupiter.api.Test;

class ReplayGateTest {

  @Test
  void isNoOpWhenCaptureModeIsDisabled() {
    assertDoesNotThrow(() -> ReplayGate.awaitCheckpoint("before-ack", "mid-1"));
  }
}
