package com.hellomq.shared;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import org.junit.jupiter.api.Test;

class ReplayGateTest {

  @Test
  void isNoOpWhenCaptureModeIsDisabled() {
    assertDoesNotThrow(() -> ReplayGate.awaitCheckpoint("before-ack", "mid-1"));
  }

  @Test
  void tokenDistinguishesContainersAndProcesses() {
    String first = ReplayGate.token("after-delivery", "mid-1", "consumer-a-1", 1);
    String otherContainer = ReplayGate.token("after-delivery", "mid-1", "consumer-b-1", 1);
    String otherProcess = ReplayGate.token("after-delivery", "mid-1", "consumer-a-2", 1);

    assertNotEquals(first, otherContainer);
    assertNotEquals(first, otherProcess);
  }
}
