# 投递语义矩阵

> 本页结论：四个产品都能构建 at-least-once 链路，但手段不同——RabbitMQ 靠两段独立确认（Confirms + ACK），Kafka 靠 acks + offset 提交，RocketMQ 靠发送响应 + Broker 内置重投，Pulsar 靠 ack/negativeAck + 游标；exactly-once 只在有限边界内成立。

覆盖 spec §8.2 的矩阵：消息模型矩阵、路由矩阵、确认与投递矩阵、事务矩阵。版本基线与标记规则见[矩阵总览](/matrix/)（checkedAt: 2026-08-19）。

## 消息模型矩阵

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar |
| :--- | :--- | :--- | :--- | :--- |
| 竞争消费（工作队列） | ✅ 多消费者共享一个 Queue，prefetch 控制分发（[routing](/brokers/rabbitmq/routing)） | ✅ Consumer Group 内按分区分配（[routing](/brokers/kafka/routing)） | ✅ 集群消费模式，组内分担 MessageQueue（[routing](/brokers/rocketmq/routing)） | ✅ Shared/Failover 订阅分发到多消费者（[routing](/brokers/pulsar/routing)） |
| 广播（发布订阅） | ✅ Fanout/Topic Exchange 一条消息复制到多 Queue（[routing](/brokers/rabbitmq/routing)） | ✅ 多个 Consumer Group 各自独立位点读全量日志（[concepts](/brokers/kafka/concepts)） | ✅ 广播消费模式或多 Consumer Group 各自消费（[concepts](/brokers/rocketmq/concepts)） | ✅ 同一 Topic 上建多个 Subscription，各自游标独立（[concepts](/brokers/pulsar/concepts)） |
| 分区日志模型 | ➖ 队列无分区、ACK 即删，不是日志；RabbitMQ Streams 是例外但不在本仓库范围（[storage-ha](/brokers/rabbitmq/storage-ha)） | ✅ 原生提交日志：追加写 + offset + retention（[storage-ha](/brokers/kafka/storage-ha)） | ✅ CommitLog 追加写 + MessageQueue 索引，消费不删（[storage-ha](/brokers/rocketmq/storage-ha)） | ✅ 分区 Topic + BookKeeper ledger，存算分离（[storage-ha](/brokers/pulsar/storage-ha)） |
| 请求-响应 | 🔧 replyTo + correlationId 组合，x-direct-reply-to 免临时队列（[routing](/brokers/rabbitmq/routing)） | 🛠 自建 request/reply Topic + correlationId 关联（[concepts](/brokers/kafka/concepts)） | 🛠 自建请求/响应 Topic 关联；部分客户端版本提供 request/reply API（[concepts](/brokers/rocketmq/concepts)） | 🛠 自建请求/响应 Topic + correlationId 关联（[concepts](/brokers/pulsar/concepts)） |

## 路由矩阵

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar |
| :--- | :--- | :--- | :--- | :--- |
| 模式/内容路由 | ✅ Direct/Topic/Fanout/Headers Exchange + Binding，Broker 端模式匹配（[routing](/brokers/rabbitmq/routing)） | ➖ 无 Broker 端模式路由；按 key 哈希到分区，内容过滤只能在消费端做（[routing](/brokers/kafka/routing)） | 🔧 Tag 过滤为 Broker 端原生；SQL92 属性过滤需 Broker 开启配置（[routing](/brokers/rocketmq/routing)） | 🧩 无 Exchange 概念；客户端支持按 Topic 模式（regex）订阅，Broker 端无模式路由（[routing](/brokers/pulsar/routing)） |
| Key 路由（决定顺序与负载） | 🔧 把业务 key 编入 routing key 绑定到固定队列，属约定而非机制（[routing](/brokers/rabbitmq/routing)） | ✅ partition key 哈希决定分区：同 key 同分区（[routing](/brokers/kafka/routing)） | ✅ FIFO 消息的 MessageGroup 决定顺序组；普通消息按队列负载分发（[routing](/brokers/rocketmq/routing)） | ✅ 分区 Topic 按 key 哈希；Key_Shared 订阅再按 key 绑定消费者（[routing](/brokers/pulsar/routing)） |

## 确认与投递矩阵

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar |
| :--- | :--- | :--- | :--- | :--- |
| 生产确认 | ✅ Publisher Confirms，异步等待 Broker 确认（[reliability](/brokers/rabbitmq/reliability)） | ✅ acks 参数：0/1/all，acks=all 需 ISR 副本确认（[reliability](/brokers/kafka/reliability)） | ✅ 发送返回 SendResult（同步/异步/oneway 三种模式）（[reliability](/brokers/rocketmq/reliability)） | ✅ producer 收到 Broker ack；send 可异步（[reliability](/brokers/pulsar/reliability)） |
| 消费确认 | ✅ 手动 basic.ack/nack；自动 ACK 模式等于不确认（[reliability](/brokers/rabbitmq/reliability)） | ✅ offset 提交即确认；自动提交有丢失/重复窗口（[reliability](/brokers/kafka/reliability)） | ✅ PushConsumer 回调返回结果 / SimpleConsumer 显式 ack（[reliability](/brokers/rocketmq/reliability)） | ✅ individual/cumulative ack 推进游标（[reliability](/brokers/pulsar/reliability)） |
| 重投递 | ✅ 未 ACK 的连接断开或 nack(requeue) 触发重新投递（[reliability](/brokers/rabbitmq/reliability)） | ✅ 基于 offset 机制：消费者崩溃后从已提交位点重读（非 Broker 主动重投）（[reliability](/brokers/kafka/reliability)） | ✅ Broker 内置：消费失败自动进入重试队列重投（[reliability](/brokers/rocketmq/reliability)） | ✅ negativeAck 或 ack 超时触发 Broker 重投（[reliability](/brokers/pulsar/reliability)） |
| 生产端去重 | ➖ 无 Broker 级消息去重，靠业务 messageId + 幂等（[pitfalls](/brokers/rabbitmq/pitfalls)） | ✅ 幂等 Producer（enable.idempotence）：PID+序列号去重，范围为单分区会话内（[reliability](/brokers/kafka/reliability)） | 🛠 Broker 不承诺全局去重，靠业务幂等表（[pitfalls](/brokers/rocketmq/pitfalls)） | 🛠 Broker 不做消费去重，靠业务幂等表（[pitfalls](/brokers/pulsar/pitfalls)） |
| at-most-once | ✅ 自动 ACK + 不确认发布即可（牺牲可靠性换简单）（[reliability](/brokers/rabbitmq/reliability)） | ✅ acks=0 + 自动提交位点（[reliability](/brokers/kafka/reliability)） | ✅ oneway 发送、失败不重发（[reliability](/brokers/rocketmq/reliability)） | ✅ 发送不等确认 + 自动 ack（[reliability](/brokers/pulsar/reliability)） |
| at-least-once | ✅ Confirms + 持久化 + 手动 ACK 组合，业务必须预期重复（[reliability](/brokers/rabbitmq/reliability)） | ✅ acks=all + 手动提交位点 + 幂等生产（[reliability](/brokers/kafka/reliability)） | ✅ 默认即 at-least-once：同步发送 + 内置重试重投（[reliability](/brokers/rocketmq/reliability)） | ✅ 手动 ack + 重投机制，业务必须预期重复（[reliability](/brokers/pulsar/reliability)） |
| exactly-once | ➖ 无 Broker 级端到端 exactly-once；用幂等消费达成业务等效（[reliability](/brokers/rabbitmq/reliability)） | ✅ 仅限 Kafka 内部：幂等 + 事务（EOS）覆盖 produce→process→produce 同一集群；写外部系统不成立（[reliability](/brokers/kafka/reliability)） | ➖ 无端到端 exactly-once；事务消息解决的是「发送与本地事务原子」（[reliability](/brokers/rocketmq/reliability)） | ➖ 消费端到端仍需幂等；事务提供的是跨分区原子操作而非外部系统 exactly-once（[reliability](/brokers/pulsar/reliability)） |

> at-least-once 意味着业务**必须预期重复**，而不是「偶尔可能重复」：数据库提交成功、ACK 前崩溃就会重投。幂等消费基准实现见[消费者崩溃与重投实验](/labs/consumer-crash)。

## 事务矩阵

| 维度 | RabbitMQ | Kafka | RocketMQ | Pulsar |
| :--- | :--- | :--- | :--- | :--- |
| 事务机制 | ✅ channel 事务（txSelect/txCommit）：把多条发布原子提交；性能差且不覆盖消费侧，生产多用 Publisher Confirms 替代（[reliability](/brokers/rabbitmq/reliability)） | ✅ 事务 API：幂等 Producer + 多分区原子写 + 消费位点提交，消费端 read_committed 隔离（[reliability](/brokers/kafka/reliability)） | ✅ 事务消息：Half Message → 本地事务 → Commit/Rollback，状态不确定时 Broker 事务回查（[reliability](/brokers/rocketmq/reliability)） | ✅ Pulsar Transactions：跨 Topic/Partition 原子发送与 ack（[reliability](/brokers/pulsar/reliability)） |
| 原子边界 | 仅「同一 channel 上多条发布要么都进 Broker 要么都不进」 | 一次事务内的多分区写入 + offset 提交，边界在 Kafka 集群内 | 「本地事务执行结果」与「消息最终投递/丢弃」二者原子 | 一个事务内的跨分区/跨 Topic 写入与消费确认 |
| 涉及外部系统 | ➖ 不包含任何业务副作用 | ➖ 写外部数据库需 Outbox/幂等消费，EOS 不延伸出集群 | ➖ 下游仍需可靠消费 + 幂等；回查只保证本地事务状态被最终确认 | ➖ 外部副作用仍需业务协调 |
| 典型用途 | 批量发布的原子性（少用） | 集群内 consume-transform-produce 管道 | 「本地事务成功 ⇔ 消息一定投递」的最终一致场景 | 跨分区原子写、流处理 Exactly-once 管道内部 |

## 脚注：同名异义

- **「事务」**：Kafka 事务是日志内原子多写 + EOS；RocketMQ 事务消息是「本地事务与消息发送的协调」（Half Message + 回查），不是分布式强一致事务；Pulsar 事务是跨分区原子操作；RabbitMQ channel 事务只是批量发布提交。四者都**不等于**跨数据库的分布式事务。
- **「确认 / ACK」**：RabbitMQ 的 ACK 是消息级逐条确认；Kafka 的「确认」是位点提交（批量、按分区）；RocketMQ 的 ack 表示单条消费结果；Pulsar 的 ack 推进游标，cumulative ack 会一次性确认之前所有消息。「已确认」都不自动等于业务副作用绝对成功。
- **「去重 / 幂等」**：Kafka 幂等 Producer 只防「发送重试造成的分区内重复写入」，不防消费重复；消费去重在四个产品中都是业务责任。

## 相关页面

- 顺序保证：[顺序矩阵](/matrix/ordering)
- 失败后的重试与 DLQ：[重试与 DLQ](/matrix/retry-dlq)
- 基础概念：[投递语义](/fundamentals/delivery-semantics)、[消息模型](/fundamentals/models)
