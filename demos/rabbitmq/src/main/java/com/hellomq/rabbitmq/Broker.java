package com.hellomq.rabbitmq;

import com.rabbitmq.client.Connection;
import com.rabbitmq.client.ConnectionFactory;
import java.io.IOException;
import java.util.concurrent.TimeoutException;

public final class Broker {

  public static final String DEFAULT_URI = "amqp://guest:guest@127.0.0.1:5672";

  private Broker() {}

  public static Connection connect(String uri) throws IOException, TimeoutException {
    ConnectionFactory factory = new ConnectionFactory();
    try {
      factory.setUri(uri);
    } catch (Exception e) {
      throw new IllegalArgumentException("invalid AMQP uri: " + uri, e);
    }
    return factory.newConnection("hello-mq-" + System.getProperty("hello-mq.role", "client"));
  }
}
