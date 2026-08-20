package com.hellomq.nats;

import io.nats.client.Connection;
import io.nats.client.Nats;
import io.nats.client.Options;
import java.io.IOException;
import java.time.Duration;

public final class Broker {

  // 支持 HELLOMQ_NATS_URL 覆盖：compose 内客户端经服务名连接（如 nats://nats:4222）。
  public static final String DEFAULT_URL =
      System.getenv().getOrDefault("HELLOMQ_NATS_URL", "nats://127.0.0.1:4222");

  private Broker() {}

  public static Connection connect(String url) throws IOException, InterruptedException {
    Options options =
        new Options.Builder()
            .server(url)
            .connectionName("hello-mq-" + System.getProperty("hello-mq.role", "client"))
            .connectionTimeout(Duration.ofSeconds(5))
            .build();
    return Nats.connect(options);
  }
}
