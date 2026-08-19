# 统一术语表

> 本页结论：以产品无关的中性术语定义核心概念；每个术语给出中性定义、各产品对应名与不可直接等价之处。覆盖 RabbitMQ / Kafka / RocketMQ / Pulsar 四个核心产品的公共概念与各自特有实体。

## Message / Record / Event / Command

- **中性定义**：在消息系统中传输的最小数据单元，含头部元数据与载荷。
- **各产品对应名**：RabbitMQ message；Kafka record；Pulsar message；RocketMQ message；Redis Streams entry；NATS message。
- **不可直接等价之处**：Kafka record 只存在于分区日志中，没有逐条删除语义；RabbitMQ message 被消费确认后即从队列移除，二者生命周期模型不同。

## Queue / Topic / Stream / Partition

- **中性定义**：消息的暂存与分发单元。Queue 通常指竞争消费的缓冲单元；Topic 是按名称订阅的逻辑通道；Partition 是日志内可并行消费的最小顺序单元。
- **各产品对应名**：RabbitMQ queue/exchange；Kafka topic+partition；RocketMQ topic+MessageQueue；Pulsar topic+partition；Redis Stream；NATS subject/stream。
- **不可直接等价之处**：RabbitMQ topic 是 exchange 类型而非订阅通道；Kafka topic 自带持久日志语义；“topic”一词在两产品中不是同一对象。

## Exchange / Binding / Routing Key

- **中性定义**：Exchange 是 RabbitMQ 中接收生产者消息并按规则分发到队列的实体；Binding 是 exchange 与队列间的路由关系；Routing Key 是消息携带的路由依据。
- **各产品对应名**：Kafka 无对应物（由 partitioner 决定分区）；Pulsar 无对应物；RocketMQ 以 Tag 做粗过滤。
- **不可直接等价之处**：RabbitMQ 的路由发生在 Broker 侧声明式绑定；Kafka 的“路由”是客户端分区计算，语义不可互换。

## Consumer / Subscription / Consumer Group

- **中性定义**：Consumer 读取并处理消息的实体；Subscription 表示一份独立的消费位置与兴趣；Consumer Group 内多个消费者分摊同一订阅的消息。
- **各产品对应名**：RabbitMQ consumer（竞争消费由同队列多消费者实现）；Kafka consumer group；Pulsar subscription（四类）；RocketMQ consumer group；Redis consumer group；NATS queue group。
- **不可直接等价之处**：Kafka consumer group 与分区绑定再均衡；RabbitMQ 无再均衡概念，消息按推送/拉取分发；Redis consumer group 的扩展受单 Stream 限制。

## ACK / NACK / Offset / Redelivered

- **中性定义**：ACK 是消费侧对“已处理”的确认；NACK 表示拒绝；Offset 是日志型系统的消费位置游标；Redelivered 标记该消息是重投递。
- **各产品对应名**：RabbitMQ ack/nack/reject + redelivered 标志；Kafka offset commit；Pulsar ack（individual/cumulative）；RocketMQ ack；Redis XACK + PEL；NATS JetStream ack。
- **不可直接等价之处**：RabbitMQ ACK 后消息删除；Kafka 提交 offset 不删除记录，且提交点之前/之后的崩溃窗口产生不同丢失/重复结果。

## Publisher Confirm / Idempotence

- **中性定义**：Publisher Confirm 是 Broker 对“已接收并承担保管责任”的生产侧确认；Idempotence 指重复提交不产生额外副作用。
- **各产品对应名**：RabbitMQ publisher confirms；Kafka idempotent producer（`enable.idempotence`）；Pulsar producer 去重（需开启）；RocketMQ 无等价内建生产幂等。
- **不可直接等价之处**：Publisher Confirm 与 Consumer ACK 是互相独立的两段确认；Kafka 幂等生产只保证单会话内分区级不重复，不等于端到端业务幂等。

## Retry / Dead Letter Queue (DLQ)

- **中性定义**：Retry 是失败消息的延迟再投递；DLQ 是多次失败后被隔离的消息去处。
- **各产品对应名**：RabbitMQ 依赖 DLX + TTL 组合实现；RocketMQ 内建消费重试与 `%DLQ%` 队列；Pulsar Retry Letter Topic + DLQ（客户端配置）；Kafka 无内建，retry topic/DLQ 属应用或框架模式。
- **不可直接等价之处**：四者实现层级不同（Broker 内建 / 客户端 / 应用模式），不能写成相同的原生机制。

## Retention / Replay

- **中性定义**：Retention 是消息保留策略（时间/大小）；Replay 是从历史位置重新消费。
- **各产品对应名**：Kafka retention + consumer seek；Pulsar retention + cursor reset；RabbitMQ Classic Queue 消费即删，回放能力有限（Stream 除外）。
- **不可直接等价之处**：“消费”在日志型产品不删除数据，在队列型产品通常删除，回放能力因此根本不同。

## Consumer Lag / Backlog

- **中性定义**：消费位置落后于最新位置的差值；泛指未处理消息的堆积。
- **各产品对应名**：Kafka consumer lag；RabbitMQ queue depth / messages ready；Pulsar backlog；Redis PEL + stream length。
- **不可直接等价之处**：队列深度包含未确认与等待中消息，lag 是游标差值，告警阈值不可互相套用。

## Leader / Replica / Quorum

- **中性定义**：Leader 是分区/队列当前提供读写的副本；Replica 是复制副本；Quorum 是多数派确认条件。
- **各产品对应名**：Kafka leader/ISR；RabbitMQ Quorum Queue（Raft 多数派）；Pulsar broker + BookKeeper ledger quorum；RocketMQ broker 主从/DLedger。
- **不可直接等价之处**：各产品“确认写成功”所需的副本条件与故障切换语义不同，须按产品单独说明。

## 顺序单元（Key / MessageGroup）

- **中性定义**：顺序保证只在某个最小单元内成立：同一单元的消息进同一顺序通道，单元之间可并行。
- **各产品对应名**：RabbitMQ 单队列（无 key 概念）；Kafka record key → partition；RocketMQ MessageGroup；Pulsar message key + 分区 + 订阅类型。
- **不可直接等价之处**：Kafka 的 key 只决定分区，顺序还受重试与幂等配置影响；RocketMQ 的 MessageGroup 是显式顺序声明；Pulsar 的顺序还依赖订阅类型（Shared 下无跨消费者顺序）。

## Tag / 消息属性过滤

- **中性定义**：在不拆分队列/topic 的前提下，按消息附带的标签在消费侧或 Broker 侧做粗过滤。
- **各产品对应名**：RocketMQ Tag（Broker 侧过滤）；Kafka 无内建（靠多 topic 或消费端判断）；RabbitMQ 用 routing key + 绑定表达；Pulsar 无内建 Tag（可自定属性由消费端过滤）。
- **不可直接等价之处**：RocketMQ Tag 是 Broker 侧过滤语义，与 RabbitMQ 的声明式绑定机制不可互换。

## 事务消息 / Half Message

- **中性定义**：把「本地事务结果」与「消息是否投递」绑定的机制：消息先以不可见状态暂存，本地事务结果决定其提交或丢弃，结果未知时由 Broker 回查。
- **各产品对应名**：RocketMQ Half Message + 事务回查；Kafka producer transaction（仅解决集群内读写原子性）；RabbitMQ 无对应（用 Outbox 模式替代）；Pulsar transaction（面向读写一致性，非本地事务回查）。
- **不可直接等价之处**：RocketMQ 事务消息解决「发送方本地事务 + 发消息」的原子性；Kafka 事务解决「跨分区写 + 消费位点」的原子性——同名「事务」，边界完全不同。

## 订阅类型（Pulsar）

- **中性定义**：同一订阅名下消息与消费者的关系模式：独占、分摊、主备、按键粘连。
- **各产品对应名**：Pulsar Exclusive / Shared / Failover / Key_Shared；Kafka 近似 consumer group（分摊，分区粒度）；RabbitMQ 近似竞争消费（分摊）。
- **不可直接等价之处**：Pulsar 四类订阅是同一 topic 上可并存的多份进度；Kafka 的「分摊」固定按分区再均衡；Shared 订阅不保证同 key 顺序（需 Key_Shared）。

## Cursor / 消费位点

- **中性定义**：订阅/消费组的消费进度标记，决定从哪条消息继续。
- **各产品对应名**：Pulsar cursor（mark delete position）；Kafka committed offset；RocketMQ 消费位点（ConsumeQueue offset）；RabbitMQ 无显式位点（ACK 即删）。
- **不可直接等价之处**：日志型产品的位点可重置回放；RabbitMQ 确认后消息即删，没有可回退的位点概念。

## NameServer / Proxy（RocketMQ）

- **中性定义**：NameServer 是无状态路由注册与发现服务；Proxy 是 5.x 引入的无状态接入层，为 gRPC 客户端提供接入与协议适配。
- **各产品对应名**：Kafka 用 controller + broker 元数据（KRaft）；RabbitMQ 客户端直连 broker；Pulsar 客户端经 broker 的 lookup 服务发现。
- **不可直接等价之处**：RocketMQ 5.x 的 gRPC 客户端必须经 Proxy 接入，与 Kafka/RabbitMQ 的直连模型不同。

## BookKeeper / Ledger（Pulsar）

- **中性定义**：BookKeeper 是 Pulsar 的持久化存储层；Ledger 是其中追加写的日志段，按 quorum 复制。
- **各产品对应名**：Kafka 分区日志文件（broker 本地盘 + ISR 复制）；RocketMQ CommitLog（broker 本地盘 + 主从/DLedger）；RabbitMQ 队列存储（本地盘 + Quorum 复制）。
- **不可直接等价之处**：Pulsar 存算分离——broker 无状态、数据在 BookKeeper；其余三者数据与计算节点绑定，扩容与故障恢复路径不同。

## Negative Ack / 主动重投

- **中性定义**：消费者主动告知 Broker「本条处理失败，请尽快重投」，区别于等待 ack 超时。
- **各产品对应名**：Pulsar negativeAcknowledge（配合 DeadLetterPolicy 达上限进 DLQ）；RabbitMQ basicNack/basicReject + requeue；Kafka 无对应（失败处理在应用层）；RocketMQ 消费返回 FAILURE 由 Broker 调度重试。
- **不可直接等价之处**：触发重投的机制与重试次数控制位置各不相同（客户端策略 / Broker 策略 / 应用层），不可互相套用参数。
