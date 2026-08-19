package com.hellomq.redisstreams;

import redis.clients.jedis.Jedis;

public final class Broker {

  public static final String DEFAULT_HOST = "127.0.0.1";
  public static final int DEFAULT_PORT = 6379;

  private Broker() {}

  public static Jedis connect(String host, int port) {
    return new Jedis(host, port);
  }
}
