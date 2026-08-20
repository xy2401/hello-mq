package com.hellomq.activemqclassic;

import jakarta.jms.Connection;
import jakarta.jms.JMSException;
import org.apache.activemq.ActiveMQConnectionFactory;

/**
 * 连接工厂：OpenWire 直连 61616（Classic 镜像默认允许匿名），
 * 支持 HELLOMQ_ACTIVEMQ_URL 覆盖：compose 内客户端经服务名连接（如 tcp://activemq:61616）。
 * 重试策略（redeliveryPolicy）可经 URL 参数下发（jms.redeliveryPolicy.*），Consumer 内亦可编程设置。
 */
public final class Broker {

  public static final String DEFAULT_URL =
      System.getenv().getOrDefault("HELLOMQ_ACTIVEMQ_URL", "tcp://127.0.0.1:61616");

  private Broker() {}

  public static Connection connect() throws JMSException {
    ActiveMQConnectionFactory factory = new ActiveMQConnectionFactory(DEFAULT_URL);
    Connection connection = factory.createConnection();
    connection.start();
    return connection;
  }
}
