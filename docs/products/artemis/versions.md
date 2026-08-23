# ActiveMQ Artemis 版本演进

ActiveMQ Artemis 是 Apache 官方下一代高性能多协议（JMS 2.0 / Jakarta Messaging, AMQP 1.0, MQTT, STOMP）消息代理。

## 核心版本演进与关键里程碑

### Artemis 2.36+（2024 年 8 月）

**主要功能与架构演进：**

- 全面支持 Jakarta Messaging 3.1 规范与 JDK 21 运行环境
- 增强双活集群间的数据镜像与网络连接断线自动恢复机制

**工程影响与选型建议：**

> 企业级 Java 与微服务异构协议网关的成熟推荐。

### Artemis 2.0（2017 年 3 月）

**主要功能与架构演进：**

- 正式确立为 Apache ActiveMQ 的下一代代码主干
- 基于 Netty 异步非阻塞事件驱动模型重构底层网络核心，吞吐比 Classic 提升一个数量级

**工程影响与选型建议：**

> 彻底重塑了 ActiveMQ 的吞吐瓶颈与协议网关能力。

## 升级建议
- 支持平滑接收来自 ActiveMQ Classic 的 OpenWire 客户端流量，是旧系统现代化的首选目标。
