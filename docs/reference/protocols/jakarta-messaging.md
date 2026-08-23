# JMS / Jakarta Messaging：Java API，不是线协议

> 本页结论：JMS（现名 Jakarta Messaging）为 Java 应用定义消息接口与语义模型，不规定网络上的字节格式。相同 JMS 代码可以由不同 Provider 实现，但 Provider 底层可能使用 OpenWire、AMQP、Artemis Core 或私有协议，配置与高级能力也不保证可移植。

## 名称演进

- **JMS**：Java Message Service 的传统名称，旧代码包名为 `javax.jms`。
- **Jakarta Messaging**：Jakarta EE 中的现名，API 包名为 `jakarta.jms`。
- 两者讨论的是 Java 编程模型，不是“JMS 端口”或统一线协议。

## 核心 API

| 接口 | 作用 |
| --- | --- |
| `ConnectionFactory` | Provider 管理的连接工厂 |
| `JMSContext` | 简化后的连接、Session 与生产消费上下文 |
| `Destination` | `Queue` 与 `Topic` 的共同抽象 |
| `JMSProducer` | 发送消息 |
| `JMSConsumer` | 同步接收或注册异步 Listener |
| `Message` | Header、Properties 与 Body 的共同模型 |

```java
try (JMSContext context = connectionFactory.createContext()) {
    Queue queue = context.createQueue("orders");
    context.createProducer().send(queue, "order=A-42");

    String body = context.createConsumer(queue)
        .receiveBody(String.class, 5_000);
}
```

代码只体现 Jakarta Messaging API。`orders` 如何映射到 Broker Address/Queue、连接使用哪个协议、是否自动创建以及怎样认证，都由 Provider 与配置决定。

## API 可移植性的边界

较容易迁移：

- Queue 与 Topic 基本收发。
- 持久/非持久投递模式、优先级和过期时间等通用属性。
- 本地事务 Session、Selector 和 Durable Subscription 的基础语义。

仍需重新验证：

- Provider URL、连接工厂、JNDI 与认证配置。
- XA、集群故障转移、消息组、延迟消息和死信策略。
- 消息类型到具体线协议 Body 的映射。
- 自动创建 Destination、地址前缀与权限模型。

## JMS、AMQP 与 OpenWire 的关系

```text
Java 应用
   ↓ Jakarta Messaging API
Provider 客户端实现
   ↓ OpenWire / AMQP 1.0 / Core / 私有协议
Broker
```

因此“应用使用 JMS”无法单独说明线上协议。排查网络兼容性、安全端口或跨语言客户端时，必须继续确认 Provider 及其 Wire Protocol。

本站映射：[ActiveMQ Artemis](/products/artemis/)与[ActiveMQ Classic](/products/activemq-classic/)都提供 JMS/Jakarta Messaging 使用路径。

官方规范：[Jakarta Messaging 3.1](https://jakarta.ee/specifications/messaging/3.1/)
