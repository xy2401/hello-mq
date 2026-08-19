# 运维观测矩阵

> 本页结论：七个产品都有官方 CLI/管理端与核心指标体系，但形态不同——RabbitMQ 自带管理 UI 与 Prometheus 端点，Kafka 靠 CLI + JMX + 第三方 Schema Registry，RocketMQ 靠 mqadmin/Dashboard + 内置重试与事务状态观测，Pulsar 靠 pulsar-admin + 原生 Schema Registry，Redis 靠 redis-cli + INFO 命令族，NATS 靠 nats CLI + 内置监控 HTTP 端点，Artemis 靠 artemis CLI + hawtio Web 控制台 + JMX；积压观测指标名不同但语义一致。

覆盖 spec §8.2「运维矩阵」的工具/指标/Schema 部分（安全能力部分见[安全](/matrix/security)）。版本基线与标记规则见[矩阵总览](/matrix/)（checkedAt: 2026-08-19）。

## 管理工具

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 官方管理工具 | ✅ rabbitmqctl/rabbitmq-diagnostics CLI + Management 插件 Web UI 与 HTTP API（[operations](/brokers/rabbitmq/operations)） | ✅ kafka-topics/kafka-consumer-groups 等 CLI；社区版无官方 Web UI（[operations](/brokers/kafka/operations)） | ✅ mqadmin CLI + RocketMQ Dashboard（[operations](/brokers/rocketmq/operations)） | ✅ pulsar-admin/pulsarctl CLI + pulsar-manager Web（[operations](/brokers/pulsar/operations)） | ✅ redis-cli 全命令族（XINFO/XCLAIM/XGROUP…）；无官方 Web UI（[operations](/brokers/redis-streams/operations)） | ✅ nats CLI + 服务器监控 HTTP 端点（/varz /jsz /connz）（[operations](/brokers/nats/operations)） | ✅ artemis CLI（data/tool 子命令）+ hawtio Web 控制台（8161，自带管理 API）（[operations](/brokers/artemis/operations)） |
| 指标导出 | ✅ 内置 Prometheus 端点与指标 API（[operations](/brokers/rabbitmq/operations)） | 🔧 JMX 为主，通常需 JMX exporter 转 Prometheus（[operations](/brokers/kafka/operations)） | 🔧 Broker 指标 + Dashboard 展示，Prometheus 接入需配置（[operations](/brokers/rocketmq/operations)） | 🔧 Broker 指标 + Prometheus 端点，需配置暴露（[operations](/brokers/pulsar/operations)） | 🔧 INFO 命令输出为主，Prometheus 需 redis_exporter 等第三方采集（[operations](/brokers/redis-streams/operations)） | 🔧 监控端点 JSON + prometheus-nats-exporter（官方独立工具）（[operations](/brokers/nats/operations)） | 🔧 JMX MBean 为主（hawtio 可视化），Prometheus 需 JMX exporter（[operations](/brokers/artemis/operations)） |

## 关键观测指标

| 指标类别 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 积压度量 | ✅ 队列消息数 + consumer 未确认数（[operations](/brokers/rabbitmq/operations)） | ✅ Consumer Lag：按消费组 × 分区（[operations](/brokers/kafka/operations)） | ✅ 消费堆积：按消费组 × Topic × 队列（[operations](/brokers/rocketmq/operations)） | ✅ Subscription Backlog：按订阅（[operations](/brokers/pulsar/operations)） | ✅ XLEN − 组 last-delivered 之后的条目数 + PEL 深度（XINFO STREAM/GROUPS）（[operations](/brokers/redis-streams/operations)） | ✅ Consumer Pending 数（/jsz 或 nats consumer info）（[operations](/brokers/nats/operations)） | ✅ 队列 MessageCount（队列深度）+ 已分页消息数（[operations](/brokers/artemis/operations)） |
| 重投/DLQ 观测 | 🔧 死信队列深度需自行监控（[operations](/brokers/rabbitmq/operations)） | 🛠 retry/DLT 是普通 Topic，积压需自建告警（[operations](/brokers/kafka/operations)） | ✅ 重试队列与 %DLQ% 消息数内置可见（[operations](/brokers/rocketmq/operations)） | 🔧 重投计数与死信 Topic 深度可观测（[operations](/brokers/pulsar/operations)） | 🔧 XPENDING 可见每条 PEL 消息的投递次数与空闲时间（[operations](/brokers/redis-streams/operations)） | 🔧 Consumer 的 num_redeliveries 可见；无 DLQ 可观测（[operations](/brokers/nats/operations)） | ✅ 死信队列深度可观测；deliveryCount 按消息可见（浏览/管理 API）（[operations](/brokers/artemis/operations)） |
| 复制/可用性状态 | ✅ Quorum Queue 成员与 raft 状态（[operations](/brokers/rabbitmq/operations)） | ✅ ISR 数量、Under-Replicated/Offline 分区（[operations](/brokers/kafka/operations)） | 🔧 主从同步状态、DLedger/Controller 选主状态（[operations](/brokers/rocketmq/operations)） | ✅ bookie 状态、ledger 副本健康（[operations](/brokers/pulsar/operations)） | ✅ INFO replication 角色与 lag；Sentinel 状态（[operations](/brokers/redis-streams/operations)） | ✅ JetStream 集群 Raft 状态与 Stream 副本健康（/jsz）（[operations](/brokers/nats/operations)） | 🔧 live/backup 配对状态与集群节点拓扑（管理 API/hawtio）（[operations](/brokers/artemis/operations)） |
| 特色状态观测 | 连接/Channel 数、内存/磁盘告警阈值 | 分区 Leader 分布、请求延迟 | 事务回查次数、发送/消费 TPS（[operations](/brokers/rocketmq/operations)） | 游标位置、unacked 消息数、限流（[operations](/brokers/pulsar/operations)） | 内存用量（maxmemory）、键空间统计、XINFO CONSUMERS（[operations](/brokers/redis-streams/operations)） | 连接数、账号限额、慢消费者告警（[operations](/brokers/nats/operations)） | 队列 paging 状态、地址内存用量、连接与会话数（[operations](/brokers/artemis/operations)） |

> 七产品的积压定位决策树是同一个：生产突增 → 消费者变慢 → 消费者离线 → 分区/队列不均 → 毒消息循环 → Broker 限流。指标映射与决策树详见[运维观测分卷](/operations/observability)。

## Schema 生态

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Schema 管理 | ➖ 无内置：契约靠应用约定或外部 Schema 仓库（[pitfalls](/brokers/rabbitmq/pitfalls)） | 🧩 非 Kafka 本体：配合第三方 Schema Registry（如 Confluent/Apicurio）做兼容性校验（[pitfalls](/brokers/kafka/pitfalls)） | ➖ 无内置 Schema Registry：靠 Tag/属性与业务约定（[pitfalls](/brokers/rocketmq/pitfalls)） | ✅ 原生 Schema Registry：为 Topic 注册 Schema 并做兼容性策略校验（[concepts](/brokers/pulsar/concepts)） | ➖ 无内置：Stream 字段是无类型键值对，契约靠应用约定（[pitfalls](/brokers/redis-streams/pitfalls)） | ➖ 无内置：Payload 是字节流，契约靠应用约定或外部 Registry（[pitfalls](/brokers/nats/pitfalls)） | ➖ 无内置：JMS/字节消息无类型契约，靠应用约定或外部 Registry（[pitfalls](/brokers/artemis/pitfalls)） |

> Schema 演进（新增可选字段兼容、破坏性变更升版本）是跨产品的通用要求，见 [schema-evolution 模式](/patterns/schema-evolution)与[消息契约规则](/guide/lab-conventions)。

## 脚注：同名异义

- **「消费位点 / Lag」**：Kafka 的 lag = 分区最新 offset − 已提交 offset；RocketMQ 的堆积按队列计算；Pulsar 的 backlog 按订阅游标；Redis Streams 的积压 = 组 last-delivered-id 之后的条目数（XLEN 可算）+ PEL 未确认数；NATS 的 pending 按消费者；Artemis 的积压 = 队列 MessageCount（含分页消息）；RabbitMQ 没有位点，积压 = 队列中未消费消息数 + unacked。数值口径不同，不可直接跨产品比较「lag 大小」。
- **「管理插件 / Dashboard / Manager」**：RabbitMQ Management、RocketMQ Dashboard、pulsar-manager、Artemis hawtio 控制台是独立项目，能力范围、权限模型与部署方式各不相同；Kafka 社区版没有对等的官方 Web UI。

## 相关页面

- 安全能力：[安全](/matrix/security)
- 容量与扩缩容：[存储与高可用、扩展与并行](/matrix/storage-ha-scaling)
- 选型时如何权衡运维成本：[选型指南](/matrix/selection-guide)
