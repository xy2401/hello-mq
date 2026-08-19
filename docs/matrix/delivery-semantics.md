# 投递语义矩阵

> 本页结论：七个产品都能构建 at-least-once 链路，但手段不同——RabbitMQ 靠两段独立确认（Confirms + ACK），Kafka 靠 acks + offset 提交，RocketMQ 靠发送响应 + Broker 内置重投，Pulsar 靠 ack/negativeAck + 游标，Redis Streams 靠 XADD 返回 + 手动 XACK + PEL，NATS 靠 Core 的无确认速递或 JetStream 的 PublishAck + 显式 Ack，Artemis 靠 JMS send 阻塞落 journal + 显式 acknowledge + 服务端重投策略；exactly-once 只在有限边界内成立。

覆盖 spec §8.2 的矩阵：消息模型矩阵、路由矩阵、确认与投递矩阵、事务矩阵。版本基线与标记规则见[矩阵总览](/matrix/)（checkedAt: 2026-08-19）。

## 消息模型矩阵

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 竞争消费（工作队列） | ✅ 多消费者共享一个 Queue，prefetch 控制分发（[routing](/brokers/rabbitmq/routing)） | ✅ Consumer Group 内按分区分配（[routing](/brokers/kafka/routing)） | ✅ 集群消费模式，组内分担 MessageQueue（[routing](/brokers/rocketmq/routing)） | ✅ Shared/Failover 订阅分发到多消费者（[routing](/brokers/pulsar/routing)） | ✅ Consumer Group 内多消费者 XREADGROUP 竞争分发（[routing](/brokers/redis-streams/routing)） | ✅ Core 用 Queue Group 竞争分发；JetStream 一个 Consumer 多实例拉取（[routing](/brokers/nats/routing)） | ✅ 同一 Queue 多消费者 round-robin 分发（[routing](/brokers/artemis/routing)） |
| 广播（发布订阅） | ✅ Fanout/Topic Exchange 一条消息复制到多 Queue（[routing](/brokers/rabbitmq/routing)） | ✅ 多个 Consumer Group 各自独立位点读全量日志（[concepts](/brokers/kafka/concepts)） | ✅ 广播消费模式或多 Consumer Group 各自消费（[concepts](/brokers/rocketmq/concepts)） | ✅ 同一 Topic 上建多个 Subscription，各自游标独立（[concepts](/brokers/pulsar/concepts)） | ✅ 多个 Consumer Group 各自持有独立位点读全量 Stream（[concepts](/brokers/redis-streams/concepts)） | ✅ Core 所有订阅者各收一份；JetStream 多个 Consumer 各自位点（[concepts](/brokers/nats/concepts)） | ✅ multicast Address：每个订阅者各自创建 Queue，各收一份（[routing](/brokers/artemis/routing)） |
| 分区日志模型 | ➖ 队列无分区、ACK 即删，不是日志；RabbitMQ Streams 是例外但不在本仓库范围（[storage-ha](/brokers/rabbitmq/storage-ha)） | ✅ 原生提交日志：追加写 + offset + retention（[storage-ha](/brokers/kafka/storage-ha)） | ✅ CommitLog 追加写 + MessageQueue 索引，消费不删（[storage-ha](/brokers/rocketmq/storage-ha)） | ✅ 分区 Topic + BookKeeper ledger，存算分离（[storage-ha](/brokers/pulsar/storage-ha)） | ✅ 原生追加日志：XADD + Entry ID + XTRIM 保留；但单 key 无分区（[storage-ha](/brokers/redis-streams/storage-ha)） | ✅ JetStream 持久日志：sequence + retention 策略；Core 是瞬态发布不算日志（[storage-ha](/brokers/nats/storage-ha)） | ➖ Queue 无分区、ack 即删，不是日志（[storage-ha](/brokers/artemis/storage-ha)） |
| 请求-响应 | 🔧 replyTo + correlationId 组合，x-direct-reply-to 免临时队列（[routing](/brokers/rabbitmq/routing)） | 🛠 自建 request/reply Topic + correlationId 关联（[concepts](/brokers/kafka/concepts)） | 🛠 自建请求/响应 Topic 关联；部分客户端版本提供 request/reply API（[concepts](/brokers/rocketmq/concepts)） | 🛠 自建请求/响应 Topic + correlationId 关联（[concepts](/brokers/pulsar/concepts)） | 🛠 自建 reply Stream + correlationId 关联（[concepts](/brokers/redis-streams/concepts)） | ✅ 原生 Request-Reply：inbox 主题 + 超时等待，Core 一等公民（[concepts](/brokers/nats/concepts)） | 🔧 JMS 标准模式：JMSReplyTo 临时队列 + JMSCorrelationID 关联（[routing](/brokers/artemis/routing)） |

## 路由矩阵

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 模式/内容路由 | ✅ Direct/Topic/Fanout/Headers Exchange + Binding，Broker 端模式匹配（[routing](/brokers/rabbitmq/routing)） | ➖ 无 Broker 端模式路由；按 key 哈希到分区，内容过滤只能在消费端做（[routing](/brokers/kafka/routing)） | 🔧 Tag 过滤为 Broker 端原生；SQL92 属性过滤需 Broker 开启配置（[routing](/brokers/rocketmq/routing)） | 🧩 无 Exchange 概念；客户端支持按 Topic 模式（regex）订阅，Broker 端无模式路由（[routing](/brokers/pulsar/routing)） | ➖ 无模式路由：一个 Stream 就是一个 key，分发只有「哪个消费组读哪个 Stream」（[routing](/brokers/redis-streams/routing)） | ✅ Subject 层级通配（`*` 单段、`>` 多段）原生模式路由；无内容/属性过滤（[routing](/brokers/nats/routing)） | 🔧 Selector（SQL-92 子集）按消息属性在 Broker 端过滤；无 Exchange 式模式绑定，目的地按 Address 名直连（[routing](/brokers/artemis/routing)） |
| Key 路由（决定顺序与负载） | 🔧 把业务 key 编入 routing key 绑定到固定队列，属约定而非机制（[routing](/brokers/rabbitmq/routing)） | ✅ partition key 哈希决定分区：同 key 同分区（[routing](/brokers/kafka/routing)） | ✅ FIFO 消息的 MessageGroup 决定顺序组；普通消息按队列负载分发（[routing](/brokers/rocketmq/routing)） | ✅ 分区 Topic 按 key 哈希；Key_Shared 订阅再按 key 绑定消费者（[routing](/brokers/pulsar/routing)） | ➖ 单 key 无分区，负载靠组内竞争消费而非 key 路由（[routing](/brokers/redis-streams/routing)） | ➖ Stream 无分区：同 Subject 消息进同一 Stream，负载靠多 Consumer 拉取（[routing](/brokers/nats/routing)） | 🔧 _AMQ_GROUP_ID：同组消息绑定同一消费者串行处理；无 key 哈希分区（[routing](/brokers/artemis/routing)） |

## 确认与投递矩阵

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 生产确认 | ✅ Publisher Confirms，异步等待 Broker 确认（[reliability](/brokers/rabbitmq/reliability)） | ✅ acks 参数：0/1/all，acks=all 需 ISR 副本确认（[reliability](/brokers/kafka/reliability)） | ✅ 发送返回 SendResult（同步/异步/oneway 三种模式）（[reliability](/brokers/rocketmq/reliability)） | ✅ producer 收到 Broker ack；send 可异步（[reliability](/brokers/pulsar/reliability)） | ✅ XADD 同步返回 Entry ID 即确认；持久性取决于 AOF/复制配置（[reliability](/brokers/redis-streams/reliability)） | ✅ JetStream 返回 PublishAck（含 seq）；Core publish 无任何确认（[reliability](/brokers/nats/reliability)） | ✅ JMS send 默认阻塞直到 Broker 写入 journal（BLOCK_ON_SEND），非阻塞发送需显式关闭（[reliability](/brokers/artemis/reliability)） |
| 消费确认 | ✅ 手动 basic.ack/nack；自动 ACK 模式等于不确认（[reliability](/brokers/rabbitmq/reliability)） | ✅ offset 提交即确认；自动提交有丢失/重复窗口（[reliability](/brokers/kafka/reliability)） | ✅ PushConsumer 回调返回结果 / SimpleConsumer 显式 ack（[reliability](/brokers/rocketmq/reliability)） | ✅ individual/cumulative ack 推进游标（[reliability](/brokers/pulsar/reliability)） | ✅ 手动 XACK 逐条确认；不 XACK 的消息留在 PEL（[reliability](/brokers/redis-streams/reliability)） | ✅ JetStream 显式 Ack/AckSync；Core 无 ACK 概念（[reliability](/brokers/nats/reliability)） | ✅ CLIENT_ACKNOWLEDGE 逐条显式 acknowledge；AUTO/DUPS_OK 模式存在丢失窗口（[reliability](/brokers/artemis/reliability)） |
| 重投递 | ✅ 未 ACK 的连接断开或 nack(requeue) 触发重新投递（[reliability](/brokers/rabbitmq/reliability)） | ✅ 基于 offset 机制：消费者崩溃后从已提交位点重读（非 Broker 主动重投）（[reliability](/brokers/kafka/reliability)） | ✅ Broker 内置：消费失败自动进入重试队列重投（[reliability](/brokers/rocketmq/reliability)） | ✅ negativeAck 或 ack 超时触发 Broker 重投（[reliability](/brokers/pulsar/reliability)） | 🔧 不自动重投：消息留在 PEL，需其他消费者 XCLAIM/XAUTOCLAIM 重领（[reliability](/brokers/redis-streams/reliability)） | ✅ JetStream：AckWait 超时或 NAK 后自动重投，MaxDeliver 封顶（[reliability](/brokers/nats/reliability)） | ✅ Broker 内置：未确认消息在连接断开或 session.recover()/rollback 后按 address-setting 重投（延迟+次数+退避）（[reliability](/brokers/artemis/reliability)） |
| 生产端去重 | ➖ 无 Broker 级消息去重，靠业务 messageId + 幂等（[pitfalls](/brokers/rabbitmq/pitfalls)） | ✅ 幂等 Producer（enable.idempotence）：PID+序列号去重，范围为单分区会话内（[reliability](/brokers/kafka/reliability)） | 🛠 Broker 不承诺全局去重，靠业务幂等表（[pitfalls](/brokers/rocketmq/pitfalls)） | 🛠 Broker 不做消费去重，靠业务幂等表（[pitfalls](/brokers/pulsar/pitfalls)） | ➖ 无去重：Entry ID 只保证唯一编号，重发产生新条目（[pitfalls](/brokers/redis-streams/pitfalls)） | 🔧 JetStream 按 Nats-Msg-Id 头在去重窗口内拒绝重复发布（窗口有限，非消费去重）（[reliability](/brokers/nats/reliability)） | 🔧 _AMQ_DUPL_ID 属性在去重窗口（id-cache-size）内拒绝重复；窗口有限，非消费去重（[reliability](/brokers/artemis/reliability)） |
| at-most-once | ✅ 自动 ACK + 不确认发布即可（牺牲可靠性换简单）（[reliability](/brokers/rabbitmq/reliability)） | ✅ acks=0 + 自动提交位点（[reliability](/brokers/kafka/reliability)） | ✅ oneway 发送、失败不重发（[reliability](/brokers/rocketmq/reliability)） | ✅ 发送不等确认 + 自动 ack（[reliability](/brokers/pulsar/reliability)） | ✅ XADD 不配 AOF/复制 + 消费者不处理失败即可（[reliability](/brokers/redis-streams/reliability)） | ✅ Core NATS 原生语义：发布即忘，无订阅者即丢（[reliability](/brokers/nats/reliability)） | ✅ 非持久消息 + 非阻塞发送 + AUTO_ACKNOWLEDGE（[reliability](/brokers/artemis/reliability)） |
| at-least-once | ✅ Confirms + 持久化 + 手动 ACK 组合，业务必须预期重复（[reliability](/brokers/rabbitmq/reliability)） | ✅ acks=all + 手动提交位点 + 幂等生产（[reliability](/brokers/kafka/reliability)） | ✅ 默认即 at-least-once：同步发送 + 内置重试重投（[reliability](/brokers/rocketmq/reliability)） | ✅ 手动 ack + 重投机制，业务必须预期重复（[reliability](/brokers/pulsar/reliability)） | ✅ AOF/复制 + 消费组 + 手动 XACK + claim 机制，业务必须预期重复（[reliability](/brokers/redis-streams/reliability)） | ✅ JetStream File 存储 + PublishAck + 显式 Ack + AckWait 重投（[reliability](/brokers/nats/reliability)） | ✅ 持久消息 + journal 落盘 + 阻塞发送 + CLIENT_ACKNOWLEDGE，业务必须预期重复（[reliability](/brokers/artemis/reliability)） |
| exactly-once | ➖ 无 Broker 级端到端 exactly-once；用幂等消费达成业务等效（[reliability](/brokers/rabbitmq/reliability)） | ✅ 仅限 Kafka 内部：幂等 + 事务（EOS）覆盖 produce→process→produce 同一集群；写外部系统不成立（[reliability](/brokers/kafka/reliability)） | ➖ 无端到端 exactly-once；事务消息解决的是「发送与本地事务原子」（[reliability](/brokers/rocketmq/reliability)） | ➖ 消费端到端仍需幂等；事务提供的是跨分区原子操作而非外部系统 exactly-once（[reliability](/brokers/pulsar/reliability)） | ➖ 无端到端 exactly-once：XACK 与业务写入是两个系统，需幂等表兜底（[reliability](/brokers/redis-streams/reliability)） | ➖ 无端到端 exactly-once：Msg-Id 去重只在发布窗口内，消费端仍需幂等（[reliability](/brokers/nats/reliability)） | ➖ 无端到端 exactly-once：XA 保证的是 Broker 内操作原子，业务副作用仍需幂等（[reliability](/brokers/artemis/reliability)） |

> at-least-once 意味着业务**必须预期重复**，而不是「偶尔可能重复」：数据库提交成功、ACK 前崩溃就会重投。幂等消费基准实现见[消费者崩溃与重投实验](/labs/consumer-crash)。

## 事务矩阵

| 维度 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 事务机制 | ✅ channel 事务（txSelect/txCommit）：把多条发布原子提交；性能差且不覆盖消费侧，生产多用 Publisher Confirms 替代（[reliability](/brokers/rabbitmq/reliability)） | ✅ 事务 API：幂等 Producer + 多分区原子写 + 消费位点提交，消费端 read_committed 隔离（[reliability](/brokers/kafka/reliability)） | ✅ 事务消息：Half Message → 本地事务 → Commit/Rollback，状态不确定时 Broker 事务回查（[reliability](/brokers/rocketmq/reliability)） | ✅ Pulsar Transactions：跨 Topic/Partition 原子发送与 ack（[reliability](/brokers/pulsar/reliability)） | ➖ 无消息事务：MULTI/EXEC 只是单实例内的命令批量原子执行，不协调业务事务与消息投递（[reliability](/brokers/redis-streams/reliability)） | ➖ 无事务：JetStream 不提供跨 Stream 原子写或「本地事务⇔投递」协调（[reliability](/brokers/nats/reliability)） | ✅ 双层：JMS 本地事务（session commit/rollback 批量原子）+ XA 两阶段提交（可协调外部 XA 资源）（[reliability](/brokers/artemis/reliability)） |
| 原子边界 | 仅「同一 channel 上多条发布要么都进 Broker 要么都不进」 | 一次事务内的多分区写入 + offset 提交，边界在 Kafka 集群内 | 「本地事务执行结果」与「消息最终投递/丢弃」二者原子 | 一个事务内的跨分区/跨 Topic 写入与消费确认 | ➖ 不适用 | ➖ 不适用 | 本地事务：同一 session 的发送/确认批量原子；XA：Broker 操作与外部 XA 资源（如数据库）一起两阶段提交 |
| 涉及外部系统 | ➖ 不包含任何业务副作用 | ➖ 写外部数据库需 Outbox/幂等消费，EOS 不延伸出集群 | ➖ 下游仍需可靠消费 + 幂等；回查只保证本地事务状态被最终确认 | ➖ 外部副作用仍需业务协调 | ➖ 一律走 Outbox + 幂等消费（[patterns](/patterns/outbox)） | ➖ 一律走 Outbox + 幂等消费（[patterns](/patterns/outbox)） | 🔧 XA 可把数据库 XA 资源纳入同一事务（七个产品中唯一），但要求全部参与方支持 XA，且有性能与恢复复杂度代价；消费端副作用仍需幂等 |
| 典型用途 | 批量发布的原子性（少用） | 集群内 consume-transform-produce 管道 | 「本地事务成功 ⇔ 消息一定投递」的最终一致场景 | 跨分区原子写、流处理 Exactly-once 管道内部 | 不适用 | 不适用 | 批量发送原子提交；「DB 写入 ⇔ 消息发送」强一致的 XA 场景 |

## 脚注：同名异义

- **「事务」**：Kafka 事务是日志内原子多写 + EOS；RocketMQ 事务消息是「本地事务与消息发送的协调」（Half Message + 回查），不是分布式强一致事务；Pulsar 事务是跨分区原子操作；RabbitMQ channel 事务只是批量发布提交；Artemis 的 JMS 本地事务是 session 内批量原子，XA 才是可纳入外部资源的分布式事务。前四者都**不等于**跨数据库的分布式事务。
- **「确认 / ACK」**：RabbitMQ 的 ACK 是消息级逐条确认；Kafka 的「确认」是位点提交（批量、按分区）；RocketMQ 的 ack 表示单条消费结果；Pulsar 的 ack 推进游标，cumulative ack 会一次性确认之前所有消息；Redis Streams 的 XACK 只移出 PEL、不删除条目；NATS JetStream 的 ack 逐条确认且 Core NATS 根本没有 ACK。「已确认」都不自动等于业务副作用绝对成功。
- **「去重 / 幂等」**：Kafka 幂等 Producer 只防「发送重试造成的分区内重复写入」，JetStream 的 Msg-Id 去重只防发布重发窗口内的重复，两者都不防消费重复；消费去重在七个产品中都是业务责任。

## 相关页面

- 顺序保证：[顺序矩阵](/matrix/ordering)
- 失败后的重试与 DLQ：[重试与 DLQ](/matrix/retry-dlq)
- 基础概念：[投递语义](/fundamentals/delivery-semantics)、[消息模型](/fundamentals/models)
