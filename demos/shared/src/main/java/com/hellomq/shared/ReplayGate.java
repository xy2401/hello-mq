package com.hellomq.shared;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Docker 证据采集门闩。普通实验完全不启用；采集模式在真实 Broker 检查点短暂停住 Consumer。
 */
public final class ReplayGate {

  private static final AtomicLong SEQUENCE = new AtomicLong();
  private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(30);

  private ReplayGate() {}

  public static void awaitCheckpoint(String checkpoint, String messageId) throws IOException, TimeoutException {
    String enabled = System.getenv().getOrDefault("HELLO_MQ_REPLAY_CAPTURE", "0").toLowerCase(Locale.ROOT);
    if (!(enabled.equals("1") || enabled.equals("true") || enabled.equals("yes"))) {
      return;
    }

    Path directory = Path.of(System.getenv().getOrDefault("HELLO_MQ_REPLAY_GATE_DIR", "/replay-gate"));
    Files.createDirectories(directory);
    String instance = System.getenv().getOrDefault("HOSTNAME", "local")
        + "-" + ProcessHandle.current().pid();
    String token = token(checkpoint, messageId, instance, SEQUENCE.incrementAndGet());
    Path reached = directory.resolve(token + ".reached");
    Path release = directory.resolve(token + ".release");
    String record = "timestamp=" + Instant.now() + " checkpoint=" + checkpoint + " messageId=" + messageId;
    Files.writeString(
        reached,
        record + System.lineSeparator(),
        StandardCharsets.UTF_8,
        StandardOpenOption.CREATE,
        StandardOpenOption.TRUNCATE_EXISTING);
    System.out.println("[replay-gate] " + record + " token=" + token + " status=waiting");
    System.out.flush();

    Instant deadline = Instant.now().plus(DEFAULT_TIMEOUT);
    while (!Files.exists(release)) {
      if (Instant.now().isAfter(deadline)) {
        throw new TimeoutException("ReplayGate timed out after 30s: " + checkpoint + " / " + messageId);
      }
      try {
        Thread.sleep(100);
      } catch (InterruptedException interrupted) {
        Thread.currentThread().interrupt();
        throw new IOException("ReplayGate interrupted", interrupted);
      }
    }
    Files.deleteIfExists(release);
    System.out.println("[replay-gate] timestamp=" + Instant.now() + " checkpoint=" + checkpoint
        + " messageId=" + messageId + " token=" + token + " status=released");
    System.out.flush();
  }

  private static String safe(String value) {
    if (value == null || value.isBlank()) return "none";
    return value.replaceAll("[^A-Za-z0-9_.-]", "_");
  }

  static String token(String checkpoint, String messageId, String instance, long sequence) {
    return safe(instance) + "-" + safe(checkpoint) + "-" + safe(messageId) + "-" + sequence;
  }
}
