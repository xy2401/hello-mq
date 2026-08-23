# 消息协议资料

协议定义客户端与服务端如何交换消息；Broker 产品则实现协议，并在其上增加存储、集群、安全、管理和运维能力。不要把协议名和产品名混为一谈。

## 通用协议与 API

| 名称 | 类型 | 核心模型 | 典型实现 | 文档 |
| --- | --- | --- | --- | --- |
| MQTT 3.1.1 / 5.0 | OASIS 线协议 | Topic 发布订阅、QoS、会话、Retained/Will | Mosquitto、EMQX、HiveMQ、Artemis | [MQTT](/reference/protocols/mqtt) |
| AMQP 0-9-1 | 开放二进制线协议 | Exchange → Binding → Queue | RabbitMQ | [AMQP 0-9-1](/reference/protocols/amqp-091) |
| AMQP 1.0 | OASIS 二进制线协议 | Container、Session、Link、Source/Target、Settlement | Artemis、RabbitMQ、ActiveMQ Classic、Azure Service Bus | [AMQP 1.0](/reference/protocols/amqp-10) |
| STOMP 1.2 | 开放文本线协议 | Destination、Frame、ACK、Transaction | Artemis、ActiveMQ Classic、RabbitMQ 插件 | [STOMP](/reference/protocols/stomp) |
| JMS / Jakarta Messaging | Java 编程 API，不是线协议 | Queue/Topic、Producer/Consumer、Session/JMSContext | Artemis、ActiveMQ Classic 等 JMS Provider | [JMS / Jakarta Messaging](/reference/protocols/jakarta-messaging) |
| OpenWire | ActiveMQ 原生二进制线协议 | Command、Destination、JMS 语义映射 | ActiveMQ Classic、Artemis 兼容层 | [OpenWire](/reference/protocols/openwire) |

## 产品私有协议

| 产品 | 主要客户端协议 | 说明 |
| --- | --- | --- |
| Kafka | Kafka Protocol | 围绕 Metadata、Produce、Fetch、Consumer Group 等 API，服务 Kafka 自身语义 |
| RocketMQ | Remoting / gRPC Proxy | 5.x 客户端经 Proxy 使用 gRPC，Broker 内部仍有产品特定协议 |
| Pulsar | Pulsar Binary Protocol | 面向 Producer、Consumer、Subscription 与 BookKeeper 存储体系 |
| NATS | NATS Protocol | 简洁文本控制行加 Payload，JetStream 能力通过 NATS API 暴露 |
| Redis Streams | RESP | Streams 是 Redis 数据类型，客户端通过通用 RESP 命令访问 |

产品私有协议并不天然“更差”；它们通常能完整表达本产品能力。开放协议的主要价值是客户端与 Broker 互操作，但不同 Broker 对地址、持久化、事务和扩展头的映射仍需实测。

## 最容易混淆的三点

1. **AMQP 0-9-1 不是 AMQP 1.0 的旧版兼容模式**：二者模型和线上帧都不同。
2. **JMS 不是协议**：Java 代码使用 JMS API，Provider 可以在底层选择 OpenWire、AMQP、Core 或其他协议。
3. **WebSocket 不是消息语义**：它是浏览器可用的双向传输，MQTT/STOMP 可以运行在 WebSocket 之上。
