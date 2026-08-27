# ActiveMQ Artemis 2.42

> **参考官方文档**：[ActiveMQ Artemis 2.42 下载与发布信息](https://activemq.apache.org/components/artemis/download/)

## 版本定位

- **发布时间：** 2025 年 7 月 17 日
- **维护状态：** 截至 2026-08-27，官方发布页列出的当前正式版本
- **运行基线：** Java 17 或更高版本
- **协议基线：** Core、AMQP 1.0、OpenWire、MQTT、STOMP 与 Jakarta Messaging

## 核心变化

- 延续 Artemis 的异步日志、高可用、集群和多协议代理架构。
- Java 17 成为明确运行基线；部署时应同步核对 JVM、客户端库和容器镜像。
- 发布包同时提供二进制、源码、校验和与签名，生产制品应完成 SHA-512 或 PGP 验证。

## 不兼容与迁移

- 升级前比较 `broker.xml`、地址设置、队列配置、鉴权插件和协议 acceptor 的变化。
- 集群或主备部署先在副本验证 journal、paging、large message 与拓扑恢复，再滚动替换节点。
- 从旧 ActiveMQ Classic 迁移时单独验证 OpenWire 客户端行为、目的地策略和持久化语义，不把协议可连接等同于完全兼容。

## 版本确认

```bash
artemis version
java -version
```

下载后还应校验发布制品：

```bash
sha512sum -c apache-artemis-2.42.0-bin.tar.gz.sha512
```

## 官方资料

- [ActiveMQ Artemis 下载页](https://activemq.apache.org/components/artemis/download/)
- [ActiveMQ Artemis 文档](https://activemq.apache.org/components/artemis/documentation/latest/)

资料核对日期：2026-08-27。
