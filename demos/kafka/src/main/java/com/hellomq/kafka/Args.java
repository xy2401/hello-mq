package com.hellomq.kafka;

import java.util.LinkedHashMap;
import java.util.Map;

public final class Args {

  private final Map<String, String> values = new LinkedHashMap<>();

  private Args() {}

  public static Args parse(String[] args) {
    Args parsed = new Args();
    for (String arg : args) {
      if (!arg.startsWith("--")) {
        throw new IllegalArgumentException("unexpected argument: " + arg);
      }
      int idx = arg.indexOf('=');
      if (idx < 0) {
        parsed.values.put(arg.substring(2), "true");
      } else {
        parsed.values.put(arg.substring(2, idx), arg.substring(idx + 1));
      }
    }
    return parsed;
  }

  public String require(String key) {
    String v = values.get(key);
    if (v == null) {
      throw new IllegalArgumentException("missing required argument: --" + key);
    }
    return v;
  }

  public String get(String key, String fallback) {
    return values.getOrDefault(key, fallback);
  }

  public int getInt(String key, int fallback) {
    String v = values.get(key);
    return v == null ? fallback : Integer.parseInt(v);
  }

  public boolean has(String key) {
    return values.containsKey(key);
  }
}
