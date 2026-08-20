# 顺序矩阵

> 本页结论：八个产品都只提供「某个单元内有序」——RabbitMQ 单队列、Kafka 分区、RocketMQ MessageGroup、Pulsar 分区+订阅类型、Redis Streams 单 Stream、NATS 单 Stream、Artemis 单队列（或 Message Group）、ActiveMQ Classic 单队列（或 Message Group JMSXGroupID）；Redis/NATS/Artemis/Classic 没有分区概念，顺序单元就是整个 Queue 或 Stream。全局顺序只能靠单一顺序单元 + 单消费者换来，且失败重试会不同程度地破坏顺序。

覆盖 spec §8.2「顺序与回放矩阵」的顺序部分。版本基线与标记规则见[矩阵总览](/matrix/)（checkedAt: 2026-08-19）。

## 最小顺序单元

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis | ActiveMQ Classic |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 局部顺序单元 | ✅ 单个 Queue 内 FIFO：入队顺序即投递顺序（[routing](/brokers/rabbitmq/routing)） | ✅ 单个 Partition 内按 offset 严格有序（[routing](/brokers/kafka/routing)） | ✅ FIFO 消息按 MessageGroup：同组有序，组间无序（[routing](/brokers/rocketmq/routing)） | ✅ 分区内有序；消费侧取决于订阅类型：Key_Shared 同 key 有序，Exclusive/Failover 分区级有序（[routing](/brokers/pulsar/routing)） | ✅ 单个 Stream 内按 Entry ID 严格有序（无分区，整条日志就是一个顺序单元）（[routing](/brokers/redis-streams/routing)） | ✅ 单个 Stream 内按 sequence 严格有序；Core NATS 同一发布者连接内按发布顺序送达（[routing](/brokers/nats/routing)） | ✅ 单个 Queue 内 FIFO；同一 Message Group（_AMQ_GROUP_ID）的消息按序交给同一消费者（[routing](/brokers/artemis/routing)） | ✅ 单个 Queue 内 FIFO；同一 Message Group（JMSXGroupID）的消息按序交给同一消费者（[routing](/brokers/activemq-classic/routing)） |
| 同业务 Key 聚到同一单元 | 🔧 把 key 编入 routing key + 绑定规则，属使用约定（[routing](/brokers/rabbitmq/routing)） | ✅ partition key 哈希，同 key 必进同一分区（[routing](/brokers/kafka/routing)） | ✅ 发送时指定 MessageGroup（如 orderId）（[routing](/brokers/rocketmq/routing)） | ✅ 分区 key 哈希 + Key_Shared 按 key 绑定消费者（[routing](/brokers/pulsar/routing)） | 🔧 无分区可做 key 路由：同 key 天然进同一 Stream（若按 key 拆 Stream），代价是 Stream 数量膨胀（[pitfalls](/brokers/redis-streams/pitfalls)） | 🔧 同理：可按 Subject 拆分 Stream 聚合 key，无原生 key 哈希（[pitfalls](/brokers/nats/pitfalls)） | ✅ 发送时指定 _AMQ_GROUP_ID（如 orderId）：同组绑定同一消费者串行（[routing](/brokers/artemis/routing)） | ✅ 发送时指定 JMSXGroupID（如 orderId）：同组绑定同一消费者串行（[routing](/brokers/activemq-classic/routing)） |
| 全局顺序 | 🔧 只用一个队列 + 单消费者，牺牲全部并行（[pitfalls](/brokers/rabbitmq/pitfalls)） | 🔧 单分区 Topic + 单消费者，牺牲全部并行（[pitfalls](/brokers/kafka/pitfalls)） | 🔧 单 MessageQueue + 顺序消费单线程，牺牲并行（[pitfalls](/brokers/rocketmq/pitfalls)） | 🔧 单分区 Topic + Exclusive 单消费者（[pitfalls](/brokers/pulsar/pitfalls)） | 🔧 单 Stream + 单消费者：Stream 本身有序，并行消费即破坏处理顺序（[pitfalls](/brokers/redis-streams/pitfalls)） | 🔧 单 Stream + 单消费者拉取（[pitfalls](/brokers/nats/pitfalls)） | 🔧 单队列 + 单消费者，牺牲全部并行（[pitfalls](/brokers/artemis/pitfalls)） | 🔧 单队列 + 单消费者，牺牲全部并行（[pitfalls](/brokers/activemq-classic/pitfalls)） |

> 「Kafka 保证全局顺序」是禁止表述；「单分区/单队列内顺序」也不等于端到端业务完成顺序——业务处理失败重试后，完成顺序仍可能变化。

## 失败与重试对顺序的影响

| 场景 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis | ActiveMQ Classic |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 消费失败后的顺序 | 🔧 nack+requeue 会把消息重新排入队列，打破原 FIFO；TTL+DLX 重试同样使消息乱序重入（[reliability](/brokers/rabbitmq/reliability)） | ✅ Broker 不重投：失败后从已提交位点重读，分区内顺序保持，但可能重复处理（[reliability](/brokers/kafka/reliability)） | ✅ FIFO 消费失败会挂起该顺序组等待重试，保序但可能阻塞后续同组消息；普通消息失败进重试队列，不阻塞但乱序（[reliability](/brokers/rocketmq/reliability)） | 🔧 Shared 重投可能换消费者、乱序；Key_Shared 同 key 重投仍绑定同一 key 的顺序约束；Exclusive/Failover 顺序保持（[reliability](/brokers/pulsar/reliability)） | 🔧 失败消息留在 PEL，被 claim 后可能由另一消费者乱序处理；日志本身顺序不变（[reliability](/brokers/redis-streams/reliability)） | 🔧 AckWait 超时后消息重投到队尾附近，可能晚于后续消息被处理；日志本身顺序不变（[reliability](/brokers/nats/reliability)） | 🔧 重投消息按 address-setting 延迟后重新入队，可能晚于后续消息被处理；Message Group 仍绑定原消费者（[reliability](/brokers/artemis/reliability)） | 🔧 rollback/断开触发按 redeliveryPolicy 重投重新入队，可能晚于后续消息被处理；Message Group 仍绑定原消费者（[reliability](/brokers/activemq-classic/reliability)） |
| 生产者发送重试与乱序 | 🔧 无内置发送排序保证，乱序风险需业务容忍或串行发送（[pitfalls](/brokers/rabbitmq/pitfalls)） | ✅ 幂等 Producer（enable.idempotence=true）保证重试写入不打乱分区内顺序（[reliability](/brokers/kafka/reliability)） | 🔧 需 FIFO 发送语义配合（同 MessageGroup 串行确认），乱发则无保序（[reliability](/brokers/rocketmq/reliability)） | 🔧 同分区并发发送可能乱序，需同 key 串行发送或顺序保证配置（[pitfalls](/brokers/pulsar/pitfalls)） | 🔧 单 Stream 内并发 XADD 按完成顺序编号：同 key 需串行发送（[pitfalls](/brokers/redis-streams/pitfalls)） | 🔧 同 Stream 并发发布按到达顺序编号：同 key 需串行发布或接受乱序（[pitfalls](/brokers/nats/pitfalls)） | 🔧 同队列并发发送按到达顺序入队：同 key 需串行发送或接受乱序（[pitfalls](/brokers/artemis/pitfalls)） | 🔧 同队列并发发送按到达顺序入队：同 key 需串行发送或接受乱序（[pitfalls](/brokers/activemq-classic/pitfalls)） |
| 毒消息对顺序的阻塞 | 🔧 队头毒消息反复 requeue 会卡住整个队列（[labs](/labs/poison-message)） | ✅ 位点继续前移由应用决定：跳过则不阻塞，重试则整分区暂停（[reliability](/brokers/kafka/reliability)） | 🔧 FIFO 队列中一条坏消息挂起整组，需人工介入或跳过策略（[pitfalls](/brokers/rocketmq/pitfalls)） | 🔧 Key_Shared 下一个 key 反复失败会卡住该 key 的消息流（[pitfalls](/brokers/pulsar/pitfalls)） | 🔧 毒消息留在 PEL 反复被 claim，需业务转写死信 Stream 或 XDEL 移除（[pitfalls](/brokers/redis-streams/pitfalls)） | 🔧 MaxDeliver 耗尽后消息被放弃不再阻塞；未设上限则反复重投（[pitfalls](/brokers/nats/pitfalls)） | ✅ max-delivery-attempts 耗尽后自动转入 dead-letter-address，不再阻塞队列（[reliability](/brokers/artemis/reliability)） | ✅ maximumRedeliveries 耗尽后自动转入默认 ActiveMQ.DLQ，不再阻塞队列（[reliability](/brokers/activemq-classic/reliability)） |

## 消费并行与顺序的互斥

顺序与并行天然互斥：同一顺序单元内只能串行消费。

| 产品 | 并行上限 | 顺序代价 |
| :--- | :--- | :--- |
| RabbitMQ | 🔧 队列数 × 每队列消费者数：并行靠拆分队列手动获得（[routing](/brokers/rabbitmq/routing)） | 需要某 key 有序时只能让该 key 独占一个队列 |
| Kafka | ✅ Consumer Group 内消费者数 ≤ 分区数：并行度由分区数原生决定（[routing](/brokers/kafka/routing)） | 同 key 消息集中在一个分区，热点 key 无法再拆分（[routing](/brokers/kafka/routing)） |
| RocketMQ | ✅ 队列数与消费线程数：集群消费模式组内分担队列（[routing](/brokers/rocketmq/routing)） | FIFO 消费下同一 MessageGroup 串行，挂起会放大延迟 |
| Pulsar | ✅ 取决于订阅类型：Shared 最自由、Key_Shared 按 key 并行、Exclusive/Failover 单活（[routing](/brokers/pulsar/routing)） | Key_Shared 在 key 倾斜时出现消费者负载不均 |
| Redis Streams | 🔧 组内多消费者竞争分发并行处理；单 Stream 无法再拆分（[routing](/brokers/redis-streams/routing)） | 并行消费即放弃处理顺序；拆分需业务自建多 Stream 分发规则 |
| NATS | 🔧 一个 Consumer 可由多实例共同拉取；Core Queue Group 并行分发（[routing](/brokers/nats/routing)） | 同上：并行与顺序互斥，Stream 无分区可拆 |
| Artemis | 🔧 同队列多消费者 round-robin 并行；并行度靠拆分队列手动获得（[routing](/brokers/artemis/routing)） | Message Group 内串行：同组绑定单消费者，组倾斜时负载不均 |
| ActiveMQ Classic | 🔧 同队列多消费者竞争分发并行；并行度靠拆分队列手动获得（[routing](/brokers/activemq-classic/routing)） | Message Group 内串行：同组绑定单消费者，组倾斜时负载不均 |

## 脚注：同名异义

- **「分区」**：Kafka/Pulsar 的 Partition 是顺序、并行与复制的基本单位；RocketMQ 的 MessageQueue 是消费视角的逻辑队列（写入先进共享 CommitLog，索引按队列组织）；RabbitMQ 队列、Redis Streams Stream、NATS JetStream Stream 都没有分区概念，「分区」一词不适用——后两者的顺序单元就是整条日志，因此也没有「分区内有序」的折中档。
- **「MessageGroup vs partition key」**：RocketMQ MessageGroup 是逐条消息显式指定的顺序组标签，可以多个组映射到同一队列；Kafka partition key 通过哈希决定分区，key 与分区是固定映射。两者都能实现「同 orderId 有序」，但粒度与映射方式不同。
- **「有序消费」**：RocketMQ 的 FIFO 消息类型是 Topic 级约束（该 Topic 只收 FIFO 消息）；Pulsar 的顺序由订阅类型决定，同一 Topic 上不同订阅可以有不同顺序语义。

## 相关页面

- 失败后的处理：[重试与 DLQ](/matrix/retry-dlq)
- 基础概念：[顺序语义](/fundamentals/ordering)
- 动手实验：[顺序、消费组与回放（Kafka）](/labs/ordering)
