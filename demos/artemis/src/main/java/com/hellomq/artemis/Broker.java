package com.hellomq.artemis;

import jakarta.jms.Connection;
import jakarta.jms.JMSException;
import org.apache.activemq.artemis.jms.client.ActiveMQConnectionFactory;

/** 连接工厂：CORE 协议直连 61616 全协议 acceptor，凭据与 compose 环境变量一致。 */
public final class Broker {

  // 支持 HELLOMQ_ARTEMIS_URL 覆盖：compose 内客户端经服务名连接（如 tcp://artemis:61616）。
  public static final String DEFAULT_URL =
      System.getenv().getOrDefault("HELLOMQ_ARTEMIS_URL", "tcp://127.0.0.1:61616");
  public static final String USER = "admin";
  public static final String PASSWORD = "hello-mq-artemis";

  private Broker() {}

  public static Connection connect() throws JMSException {
    ActiveMQConnectionFactory factory = new ActiveMQConnectionFactory(DEFAULT_URL, USER, PASSWORD);
    Connection connection = factory.createConnection();
    connection.start();
    return connection;
  }
}
