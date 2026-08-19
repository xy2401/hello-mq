package com.hellomq.shared;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 统一结构化日志（规格 §12.2）。输出 key=value 单行，键序固定，便于实验断言与快照归一化。
 */
public final class LabLogger {

  private final String role;
  private final String product;
  private final String lab;
  private final String service;

  private LabLogger(String role, String product, String lab, String service) {
    this.role = role;
    this.product = product;
    this.lab = lab;
    this.service = service;
  }

  public static LabLogger of(String role, String product, String lab, String service) {
    return new LabLogger(role, product, lab, service);
  }

  public Entry entry() {
    return new Entry();
  }

  public final class Entry {
    private final Map<String, String> fields = new LinkedHashMap<>();

    private Entry() {
      fields.put("level", "INFO");
      fields.put("service", service);
      fields.put("product", product);
      fields.put("lab", lab);
    }

    public Entry envelope(Envelope env) {
      if (env == null) {
        return this;
      }
      put("messageId", env.getMessageId());
      put("eventType", env.getEventType());
      if (env.getSchemaVersion() > 0) {
        fields.put("schemaVersion", String.valueOf(env.getSchemaVersion()));
      }
      put("aggregateId", env.getAggregateId());
      put("traceId", env.getTraceId());
      put("correlationId", env.getCorrelationId());
      return this;
    }

    public Entry put(String key, String value) {
      if (value != null && !value.isEmpty()) {
        fields.put(key, value);
      }
      return this;
    }

    public Entry put(String key, long value) {
      fields.put(key, String.valueOf(value));
      return this;
    }

    public Entry put(String key, boolean value) {
      fields.put(key, String.valueOf(value));
      return this;
    }

    public Entry status(String status) {
      return put("status", status);
    }

    public Entry duration(long startNanos) {
      return put("durationMs", (System.nanoTime() - startNanos) / 1_000_000);
    }

    public String emit() {
      StringBuilder sb = new StringBuilder("[").append(role).append("] ");
      sb.append("timestamp=").append(Instant.now().toString());
      for (Map.Entry<String, String> e : fields.entrySet()) {
        sb.append(' ').append(e.getKey()).append('=').append(e.getValue());
      }
      String line = sb.toString();
      System.out.println(line);
      System.out.flush();
      return line;
    }
  }
}
