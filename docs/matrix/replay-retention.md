# 回放与保留矩阵

> 本页结论：RabbitMQ 是队列语义——ACK 即删、不可回放；Kafka、RocketMQ、Pulsar、Redis Streams、NATS JetStream 都是日志语义——消费不删除消息，可按位点/序列号回放，保留由各自的修剪/保留策略决定；注意 NATS 的 WorkQueue/Interest 保留策略是日志模型中的例外（确认即删）。

覆盖 spec §8.2「顺序与回放矩阵」的回放部分与「存储与保留矩阵」。版本基线与标记规则见[矩阵总览](/matrix/)（checkedAt: 2026-08-19）。

## 存储与保留

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 消费后是否删除 | ✅ 删除：队列语义，消息 ACK 后即从队列移除，与消费进度强绑定（[storage-ha](/brokers/rabbitmq/storage-ha)） | ➖ 不删除：消费只推进 offset，记录保留与否只由 retention 决定（[storage-ha](/brokers/kafka/storage-ha)） | ➖ 不删除：CommitLog 按保留策略清理，与消费进度无关（[storage-ha](/brokers/rocketmq/storage-ha)） | ➖ 不删除：ledger 数据按 namespace 保留策略清理，ack 只推进游标（[storage-ha](/brokers/pulsar/storage-ha)） | ➖ 不删除：XACK 只移出 PEL，条目保留与否只由 XTRIM/MAXLEN/MINID 决定（[storage-ha](/brokers/redis-streams/storage-ha)） | 🔧 取决于保留策略：Limits 不删；WorkQueue 全部消费者 ack 后即删；Interest 无匹配订阅即删（[storage-ha](/brokers/nats/storage-ha)） |
| 时间/大小保留 | ➖ 不适用：无「保留期」概念；TTL 与 max-length 是队列上限/过期手段，不是历史保留（[storage-ha](/brokers/rabbitmq/storage-ha)） | ✅ retention.ms / retention.bytes / cleanup.policy 按 Topic 配置（[storage-ha](/brokers/kafka/storage-ha)） | ✅ CommitLog 文件按保留时间清理（fileReservedTime 默认 72 小时）+ 磁盘水位触发删除（[storage-ha](/brokers/rocketmq/storage-ha)） | ✅ namespace 级 retention（时间/大小），可设 0（即删）或无限（配合分层存储）（[storage-ha](/brokers/pulsar/storage-ha)） | ✅ XTRIM MAXLEN/MINID（可近似时间）：按条数或最小 Entry ID 修剪，内存受限需主动管理（[storage-ha](/brokers/redis-streams/storage-ha)） | ✅ Stream 级 MaxAge/MaxBytes/MaxMsgs 配置（[storage-ha](/brokers/nats/storage-ha)） |
| 日志压缩（Compaction） | ➖ 无此概念 | ✅ log compaction：按 key 只保留最新值，适合状态表/变更日志（[storage-ha](/brokers/kafka/storage-ha)） | ➖ 无原生 compaction | ➖ 无原生 compaction | ➖ 无原生 compaction | ➖ 无原生 compaction |
| 分层存储（Tiered Storage） | ➖ 无 | 🔧 KIP-405 远程分层存储：需配置 RemoteStorageManager 插件与远端存储（[storage-ha](/brokers/kafka/storage-ha)） | 🔧 5.x 提供独立部署的分层存储组件，需额外组件与配置（[storage-ha](/brokers/rocketmq/storage-ha)） | 🔧 原生 Tiered Storage 能力，需安装 offloader 并为 namespace 配置策略（如 S3/HDFS）（[storage-ha](/brokers/pulsar/storage-ha)） | ➖ 无：数据在 Redis 内存/磁盘（AOF），无冷数据下沉能力（[pitfalls](/brokers/redis-streams/pitfalls)） | ➖ 无原生分层存储（[pitfalls](/brokers/nats/pitfalls)） |

## 回放能力

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 历史回放 | ➖ 不适用：ACK 即删，没有可回读的历史（RabbitMQ Streams 是例外，不在本仓库范围）（[storage-ha](/brokers/rabbitmq/storage-ha)） | ✅ 原生：按 offset 或时间戳 seek/重置消费位点，多消费组可各自回放（[storage-ha](/brokers/kafka/storage-ha)，[实验](/labs/ordering)） | ✅ 原生：重置消费位点（按时间戳/最大最小位点），保留期内可重读（[storage-ha](/brokers/rocketmq/storage-ha)） | ✅ 原生：reset-cursor 按时间戳或 message ID 重置订阅游标（[storage-ha](/brokers/pulsar/storage-ha)） | ✅ 原生：新建消费组从 0-0 起读，或 XGROUP SETID/XRANGE 按 Entry ID 重读（受 XTRIM 限制）（[storage-ha](/brokers/redis-streams/storage-ha)） | ✅ 原生：按 DeliverByStartSequence/DeliverByStartTime 创建新消费者回放（[storage-ha](/brokers/nats/storage-ha)） |
| 位点控制粒度 | ➖ Broker 不暴露消费位点 | ✅ 分区级 offset，任意位置 seek（[concepts](/brokers/kafka/concepts)） | 🔧 消费组 × Topic × 队列级别重置，粒度为队列（[concepts](/brokers/rocketmq/concepts)） | ✅ 订阅级游标，可到具体 message ID（[concepts](/brokers/pulsar/concepts)） | ✅ 消费组级 last-delivered-id，XGROUP SETID 可到任意 Entry ID（[concepts](/brokers/redis-streams/concepts)） | ✅ 消费者级 sequence，可精确到单条消息或时间点（[concepts](/brokers/nats/concepts)） |
| 多订阅独立回放 | ➖ 消息一旦被某队列 ACK 即消失，不存在多订阅各自重读 | ✅ 每个 Consumer Group 独立位点，互不影响（[concepts](/brokers/kafka/concepts)） | ✅ 每个 Consumer Group 独立消费位点（[concepts](/brokers/rocketmq/concepts)） | ✅ 每个 Subscription 独立游标，可单独重置（[concepts](/brokers/pulsar/concepts)） | ✅ 每个 Consumer Group 独立位点，可各自回放（[concepts](/brokers/redis-streams/concepts)） | ✅ 每个 Consumer 独立位点，可单独重建回放（[concepts](/brokers/nats/concepts)） |
| 回放对生产者的影响 | ➖ | ✅ 回放是纯读操作，不移动日志、不影响其他消费组（[storage-ha](/brokers/kafka/storage-ha)） | ✅ 重置位点不影响 CommitLog 与其他消费组（[storage-ha](/brokers/rocketmq/storage-ha)） | ✅ reset-cursor 只动该订阅游标（[storage-ha](/brokers/pulsar/storage-ha)） | ✅ 新建组/XGROUP SETID 只动该组位点，不改 Stream 内容（[storage-ha](/brokers/redis-streams/storage-ha)） | ✅ 新建回放消费者不影响既有消费者（[storage-ha](/brokers/nats/storage-ha)） |

> 积压恢复与回放是两回事：积压是消费者追赶未消费消息，回放是主动把位点拨回已消费过的历史。积压定位见[背压与积压](/fundamentals/backpressure)，积压恢复实验见 [backlog-recovery](/labs/backlog-recovery)。

## 脚注：同名异义

- **「回放 vs 重投递」**：回放（replay）是保留期内按位点重读历史，是主动运维/数据修复动作；重投递（redelivery）是消费失败或未确认后的补偿投递。RabbitMQ 有重投递但没有回放；不要把 requeue 叫作回放。
- **「保留 vs 上限」**：Kafka retention、RocketMQ fileReservedTime、Pulsar retention policy 是「历史保留策略」；RabbitMQ 的 TTL/max-length 是「队列内消息的过期与上限」，消息不是被保留下来，而是被丢弃或死信——二者语义相反。
- **「消费进度」**：Kafka 是 offset（数字位点）、RocketMQ 是消费位点（可按时间重置）、Pulsar 是 cursor（可 reset 到 message ID）、Redis Streams 是消费组 last-delivered-id（XGROUP SETID 可改）、NATS 是消费者 sequence；RabbitMQ 没有暴露给用户的位点。只有存在位点/游标的产品才谈得上「重置」。

## 相关页面

- 存储层如何支撑保留与高可用：[存储与高可用、扩展与并行](/matrix/storage-ha-scaling)
- 基础概念：[存储与回放](/fundamentals/storage-and-replay)
- 动手实验：[顺序、消费组与回放（Kafka）](/labs/ordering)
