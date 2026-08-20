package com.hellomq.redisstreams;

import redis.clients.jedis.Jedis;

public final class Broker {

  // 支持 HELLOMQ_REDIS_HOST/PORT 覆盖：compose 内客户端经服务名连接（如 redis）。
  public static final String DEFAULT_HOST = System.getenv().getOrDefault("HELLOMQ_REDIS_HOST", "127.0.0.1");
  public static final int DEFAULT_PORT =
      Integer.parseInt(System.getenv().getOrDefault("HELLOMQ_REDIS_PORT", "6379"));

  private Broker() {}

  public static Jedis connect(String host, int port) {
    return new Jedis(host, port);
  }
}
