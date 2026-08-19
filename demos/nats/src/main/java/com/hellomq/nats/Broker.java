package com.hellomq.nats;

import io.nats.client.Connection;
import io.nats.client.Nats;
import io.nats.client.Options;
import java.io.IOException;
import java.time.Duration;

public final class Broker {

  public static final String DEFAULT_URL = "nats://127.0.0.1:4222";

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
