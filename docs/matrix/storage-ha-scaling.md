# 存储与高可用、扩展与并行矩阵

> 本页结论：六个产品的高可用模型差异极大——RabbitMQ 以队列为单位做 Raft 多数派复制（Quorum Queue），Kafka 以分区为单位做 ISR 副本，RocketMQ 以 Broker 为单位做主从/DLedger 复制，Pulsar 把存储下沉到 BookKeeper、Broker 本身无状态，Redis 靠主从复制 + Sentinel 故障转移（Stream 是单 key 无法分片），NATS JetStream 以 Stream 为单位做 Raft 复制；扩展粒度与多租户能力同样由各自架构决定。

覆盖 spec §8.2「高可用与扩展矩阵」，并合并「存储与高可用」「扩展与并行」两个主题。版本基线与标记规则见[矩阵总览](/matrix/)（checkedAt: 2026-08-19）。

## 复制与高可用

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 复制单元与协议 | ✅ Quorum Queue：队列级 Raft 多数派复制（[storage-ha](/brokers/rabbitmq/storage-ha)） | ✅ 分区级副本 + ISR（in-sync replicas）机制，KRaft 复制元数据（[storage-ha](/brokers/kafka/storage-ha)） | 🔧 Broker 主从复制：同步双写/异步复制；DLedger/Controller 模式可自动选主，需额外部署形态（[storage-ha](/brokers/rocketmq/storage-ha)） | ✅ 存算分离：消息写入 BookKeeper ledger 多副本，Broker 无状态、随时可替换（[storage-ha](/brokers/pulsar/storage-ha)） | 🔧 实例级主从复制（异步）：Stream 随实例复制；集群模式按 key 分片但单个 Stream 仍是单 key（[storage-ha](/brokers/redis-streams/storage-ha)） | ✅ Stream 级 Raft 复制：R3 Stream 跨节点多数派（需 JetStream 集群模式）（[storage-ha](/brokers/nats/storage-ha)） |
| 写入确认条件 | 🔧 Quorum Queue 写入需多数派落盘才确认，延迟高于单节点（[storage-ha](/brokers/rabbitmq/storage-ha)） | ✅ acks=all 要求 ISR 全部副本确认；配合 min.insync.replicas 控制可写性（[reliability](/brokers/kafka/reliability)） | 🔧 同步双写等主从都成功；异步复制主机确认即返回（[reliability](/brokers/rocketmq/reliability)） | ✅ 写确认需 ensemble 中满足 write/ack quorum 的 bookie 落盘（可配）（[storage-ha](/brokers/pulsar/storage-ha)） | 🔧 主节点写入即返回；WAIT 可等待副本确认，AOF 刷盘策略另配（[reliability](/brokers/redis-streams/reliability)） | ✅ R>1 时写确认需 Raft 多数派落盘（[storage-ha](/brokers/nats/storage-ha)） |
| 故障容忍 | ✅ Quorum Queue 可容忍少数派节点丢失；失去多数派时该队列不可写（保数据安全）（[storage-ha](/brokers/rabbitmq/storage-ha)） | ✅ ISR 收缩后仍可读写；ISR 少于 min.insync.replicas 时拒写（[storage-ha](/brokers/kafka/storage-ha)） | 🔧 异步复制主机宕机有丢消息窗口；同步双写从机故障影响可用性（[pitfalls](/brokers/rocketmq/pitfalls)） | ✅ bookie 故障后自动触发副本修复（rereplication）；Broker 故障由无状态架构直接接管（[storage-ha](/brokers/pulsar/storage-ha)） | 🔧 异步复制下主节点宕机有丢数据窗口；Sentinel 自动故障转移但非强一致（[storage-ha](/brokers/redis-streams/storage-ha)） | ✅ R3 Stream 容忍少数派节点故障；单节点 R1 无容错（[storage-ha](/brokers/nats/storage-ha)） |
| 元数据服务 | ✅ 节点间内置（4.x 无外部依赖） | ✅ KRaft 内置控制器集群，无需 ZooKeeper（[storage-ha](/brokers/kafka/storage-ha)） | ✅ NameServer 集群无状态注册发现；5.x 架构为 proxy + namesrv + broker（[concepts](/brokers/rocketmq/concepts)） | 🔧 依赖 ZooKeeper/Oxia 存元数据，是部署的一部分（[storage-ha](/brokers/pulsar/storage-ha)） | ✅ 无独立元数据服务；Sentinel/Cluster 自带元数据机制（[storage-ha](/brokers/redis-streams/storage-ha)） | ✅ 无外部依赖：JetStream 元数据内置 Raft 管理（[storage-ha](/brokers/nats/storage-ha)） |

## 扩展与并行

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 扩容粒度 | 🔧 增加队列数 + 增加节点分担队列；单队列无分区，吞吐受单队列上限约束（[storage-ha](/brokers/rabbitmq/storage-ha)） | ✅ 分区是并行单位：Topic 分区数决定消费并行度；分区只能增、难缩（[storage-ha](/brokers/kafka/storage-ha)） | ✅ MessageQueue 数可调：队列数决定消费并行度，可在线调整（[storage-ha](/brokers/rocketmq/storage-ha)） | ✅ 分区 Topic + Broker 水平扩展；存算分离使存储容量（bookie）与服务层独立扩缩（[storage-ha](/brokers/pulsar/storage-ha)） | 🔧 单 Stream 无法拆分：扩容靠增加 Stream 数 + 增加消费组成员；集群模式横向分片到多 key（[storage-ha](/brokers/redis-streams/storage-ha)） | 🔧 单 Stream 无分区：扩容靠 Subject 拆分多 Stream + 增加消费实例（[storage-ha](/brokers/nats/storage-ha)） |
| 消费并行上限 | 队列数（每队列内竞争消费，prefetch 控流） | Consumer Group 内有效消费者数 ≤ 分区数，多余消费者空闲（[routing](/brokers/kafka/routing)） | 队列数 × 消费线程配置（集群消费模式组内分担队列）（[routing](/brokers/rocketmq/routing)） | 由订阅类型决定：Shared 最灵活、Key_Shared ≤ 不同 key 数、Exclusive/Failover 单活（[routing](/brokers/pulsar/routing)） | 组内消费者数无硬性上限，但都从同一 Stream 拉取，吞吐受单 Stream 与实例能力约束（[routing](/brokers/redis-streams/routing)） | 一个 Consumer 可多实例共同拉取；并行度不受「分区数」限制但受 Stream 吞吐限制（[routing](/brokers/nats/routing)） |
| 热点拆分能力 | 🔧 靠拆分队列手动分摊 | 🔧 热点 key 集中在单分区，需业务改造 key 设计（[pitfalls](/brokers/kafka/pitfalls)） | 🔧 MessageGroup 倾斜时同样集中到单队列（[pitfalls](/brokers/rocketmq/pitfalls)） | 🔧 Key_Shared 的 key 倾斜导致消费者负载不均（[pitfalls](/brokers/pulsar/pitfalls)） | 🔧 热点 Stream 无法拆分，只能业务层拆分多 Stream（[pitfalls](/brokers/redis-streams/pitfalls)） | 🔧 热点 Stream 无法拆分，只能按 Subject 拆多 Stream（[pitfalls](/brokers/nats/pitfalls)） |
| 多租户 | ✅ Virtual Host：vhost 级资源与权限隔离（轻量，无原生配额体系）（[concepts](/brokers/rabbitmq/concepts)） | ➖ 无原生租户层级：topic 命名约定 + ACL + Quota 组合近似（[operations](/brokers/kafka/operations)） | ➖ 无原生租户层级：ACL + 部署层隔离（[operations](/brokers/rocketmq/operations)） | ✅ 原生 Tenant/Namespace 层级：配额、保留策略、权限按命名空间管理（[concepts](/brokers/pulsar/concepts)） | ➖ 无租户层级：ACL + DB 编号/键前缀约定（[operations](/brokers/redis-streams/operations)） | ✅ 原生 Account 层级：每账号独立 Subject 空间、权限与 JetStream 配额（[concepts](/brokers/nats/concepts)） |

## 路由与分发机制（扩展视角）

| 产品 | 机制 | 对扩展的影响 |
| :--- | :--- | :--- |
| RabbitMQ | ✅ Exchange + Binding（[routing](/brokers/rabbitmq/routing)） | 路由灵活但消息落点由绑定决定，扩容靠增加队列 |
| Kafka | ✅ partition key 哈希（[routing](/brokers/kafka/routing)） | key 分布直接决定负载是否均匀 |
| RocketMQ | ✅ Topic + MessageQueue 选择 / MessageGroup（[routing](/brokers/rocketmq/routing)） | 队列数与发送策略共同决定负载分布 |
| Pulsar | ✅ 分区 key + 订阅类型（[routing](/brokers/pulsar/routing)） | 分区数决定服务层并行，BookKeeper 决定存储扩展 |
| Redis Streams | ✅ 单 key Stream + 消费组竞争（[routing](/brokers/redis-streams/routing)） | 无分片路由：扩展只能靠业务拆分多个 Stream |
| NATS | ✅ Subject 通配路由 + Stream 捕获（[routing](/brokers/nats/routing)） | 路由灵活但 Stream 无分区：扩展靠 Subject 树拆分 |

完整路由语义见[投递语义矩阵](/matrix/delivery-semantics)的路由部分。

## 脚注：同名异义

- **「扩容」**：Kafka/RocketMQ/Pulsar 的扩容主要是「增加分区/队列并重均衡」；RabbitMQ 的扩容是「增加队列并把队列分布到更多节点」——前者扩的是数据分片，后者扩的是独立队列的数量。
- **「副本」**：Kafka replica 是分区副本（有 Leader/Follower 与 ISR）；RabbitMQ Quorum 副本是 Raft 成员（多数派概念，无 ISR）；RocketMQ 主从是 Broker 级角色；Pulsar 的副本在 BookKeeper ledger 层（bookie 不区分 leader）；Redis 副本是整个实例的主从镜像（异步、无分片感知）；NATS 副本是 Stream 级 Raft 组成员。六者的故障切换方式与数据一致性窗口都不同。
- **「Broker 无状态」**：仅对 Pulsar 成立——其消息状态在 BookKeeper，Broker 宕机不丢数据；Kafka/RocketMQ 的 Broker 本身持有数据（或主从持有），RabbitMQ 节点持有队列数据。

## 相关页面

- 保留与回放的差异：[回放与保留](/matrix/replay-retention)
- 安全与租户隔离的配套：[安全](/matrix/security)
- 运维视角的扩缩容操作：[运维观测](/matrix/operations)
