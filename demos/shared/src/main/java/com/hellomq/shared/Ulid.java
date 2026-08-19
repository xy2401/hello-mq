package com.hellomq.shared;

import java.security.SecureRandom;
import java.time.Instant;

/** Crockford base32 的极简 ULID，用于生成全局唯一 messageId。 */
public final class Ulid {

  private static final char[] ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ".toCharArray();
  private static final SecureRandom RANDOM = new SecureRandom();

  private Ulid() {}

  public static String generate() {
    long ts = Instant.now().toEpochMilli();
    byte[] random = new byte[10];
    RANDOM.nextBytes(random);
    char[] out = new char[26];
    for (int i = 9; i >= 0; i--) {
      out[i] = ENCODING[(int) (ts & 0x1F)];
      ts >>>= 5;
    }
    long hi = 0;
    for (int i = 0; i < 5; i++) {
      hi = (hi << 8) | (random[i] & 0xFF);
    }
    long lo = 0;
    for (int i = 5; i < 10; i++) {
      lo = (lo << 8) | (random[i] & 0xFF);
    }
    for (int i = 15; i >= 10; i--) {
      out[i] = ENCODING[(int) (hi & 0x1F)];
      hi >>>= 5;
    }
    for (int i = 25; i >= 16; i--) {
      out[i] = ENCODING[(int) (lo & 0x1F)];
      lo >>>= 5;
    }
    return new String(out);
  }
}
