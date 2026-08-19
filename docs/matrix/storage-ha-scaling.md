# 存储与高可用、扩展与并行矩阵

> 本页结论：四个产品的高可用模型差异极大——RabbitMQ 以队列为单位做 Raft 多数派复制（Quorum Queue），Kafka 以分区为单位做 ISR 副本，RocketMQ 以 Broker 为单位做主从/DLedger 复制，Pulsar 把存储下沉到 BookKeeper、Broker 本身无状态；扩展粒度与多租户能力同样由各自架构决定。

覆盖 spec §8.2「高可用与扩展矩阵」，并合并「存储与高可用」「扩展与并行」两个主题。版本基线与标记规则见[矩阵总览](/matrix/)（checkedAt: 2026-08-19）。

## 复制与高可用

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar |
| :--- | :--- | :--- | :--- | :--- |
| 复制单元与协议 | ✅ Quorum Queue：队列级 Raft 多数派复制（[storage-ha](/brokers/rabbitmq/storage-ha)） | ✅ 分区级副本 + ISR（in-sync replicas）机制，KRaft 复制元数据（[storage-ha](/brokers/kafka/storage-ha)） | 🔧 Broker 主从复制：同步双写/异步复制；DLedger/Controller 模式可自动选主，需额外部署形态（[storage-ha](/brokers/rocketmq/storage-ha)） | ✅ 存算分离：消息写入 BookKeeper ledger 多副本，Broker 无状态、随时可替换（[storage-ha](/brokers/pulsar/storage-ha)） |
| 写入确认条件 | 🔧 Quorum Queue 写入需多数派落盘才确认，延迟高于单节点（[storage-ha](/brokers/rabbitmq/storage-ha)） | ✅ acks=all 要求 ISR 全部副本确认；配合 min.insync.replicas 控制可写性（[reliability](/brokers/kafka/reliability)） | 🔧 同步双写等主从都成功；异步复制主机确认即返回（[reliability](/brokers/rocketmq/reliability)） | ✅ 写确认需 ensemble 中满足 write/ack quorum 的 bookie 落盘（可配）（[storage-ha](/brokers/pulsar/storage-ha)） |
| 故障容忍 | ✅ Quorum Queue 可容忍少数派节点丢失；失去多数派时该队列不可写（保数据安全）（[storage-ha](/brokers/rabbitmq/storage-ha)） | ✅ ISR 收缩后仍可读写；ISR 少于 min.insync.replicas 时拒写（[storage-ha](/brokers/kafka/storage-ha)） | 🔧 异步复制主机宕机有丢消息窗口；同步双写从机故障影响可用性（[pitfalls](/brokers/rocketmq/pitfalls)） | ✅ bookie 故障后自动触发副本修复（rereplication）；Broker 故障由无状态架构直接接管（[storage-ha](/brokers/pulsar/storage-ha)） |
| 元数据服务 | ✅ 节点间内置（4.x 无外部依赖） | ✅ KRaft 内置控制器集群，无需 ZooKeeper（[storage-ha](/brokers/kafka/storage-ha)） | ✅ NameServer 集群无状态注册发现；5.x 架构为 proxy + namesrv + broker（[concepts](/brokers/rocketmq/concepts)） | 🔧 依赖 ZooKeeper/Oxia 存元数据，是部署的一部分（[storage-ha](/brokers/pulsar/storage-ha)） |

## 扩展与并行

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar |
| :--- | :--- | :--- | :--- | :--- |
| 扩容粒度 | 🔧 增加队列数 + 增加节点分担队列；单队列无分区，吞吐受单队列上限约束（[storage-ha](/brokers/rabbitmq/storage-ha)） | ✅ 分区是并行单位：Topic 分区数决定消费并行度；分区只能增、难缩（[storage-ha](/brokers/kafka/storage-ha)） | ✅ MessageQueue 数可调：队列数决定消费并行度，可在线调整（[storage-ha](/brokers/rocketmq/storage-ha)） | ✅ 分区 Topic + Broker 水平扩展；存算分离使存储容量（bookie）与服务层独立扩缩（[storage-ha](/brokers/pulsar/storage-ha)） |
| 消费并行上限 | 队列数（每队列内竞争消费，prefetch 控流） | Consumer Group 内有效消费者数 ≤ 分区数，多余消费者空闲（[routing](/brokers/kafka/routing)） | 队列数 × 消费线程配置（集群消费模式组内分担队列）（[routing](/brokers/rocketmq/routing)） | 由订阅类型决定：Shared 最灵活、Key_Shared ≤ 不同 key 数、Exclusive/Failover 单活（[routing](/brokers/pulsar/routing)） |
| 热点拆分能力 | 🔧 靠拆分队列手动分摊 | 🔧 热点 key 集中在单分区，需业务改造 key 设计（[pitfalls](/brokers/kafka/pitfalls)） | 🔧 MessageGroup 倾斜时同样集中到单队列（[pitfalls](/brokers/rocketmq/pitfalls)） | 🔧 Key_Shared 的 key 倾斜导致消费者负载不均（[pitfalls](/brokers/pulsar/pitfalls)） |
| 多租户 | ✅ Virtual Host：vhost 级资源与权限隔离（轻量，无原生配额体系）（[concepts](/brokers/rabbitmq/concepts)） | ➖ 无原生租户层级：topic 命名约定 + ACL + Quota 组合近似（[operations](/brokers/kafka/operations)） | ➖ 无原生租户层级：ACL + 部署层隔离（[operations](/brokers/rocketmq/operations)） | ✅ 原生 Tenant/Namespace 层级：配额、保留策略、权限按命名空间管理（[concepts](/brokers/pulsar/concepts)） |

## 路由与分发机制（扩展视角）

| 产品 | 机制 | 对扩展的影响 |
| :--- | :--- | :--- |
| RabbitMQ | ✅ Exchange + Binding（[routing](/brokers/rabbitmq/routing)） | 路由灵活但消息落点由绑定决定，扩容靠增加队列 |
| Kafka | ✅ partition key 哈希（[routing](/brokers/kafka/routing)） | key 分布直接决定负载是否均匀 |
| RocketMQ | ✅ Topic + MessageQueue 选择 / MessageGroup（[routing](/brokers/rocketmq/routing)） | 队列数与发送策略共同决定负载分布 |
| Pulsar | ✅ 分区 key + 订阅类型（[routing](/brokers/pulsar/routing)） | 分区数决定服务层并行，BookKeeper 决定存储扩展 |

完整路由语义见[投递语义矩阵](/matrix/delivery-semantics)的路由部分。

## 脚注：同名异义

- **「扩容」**：Kafka/RocketMQ/Pulsar 的扩容主要是「增加分区/队列并重均衡」；RabbitMQ 的扩容是「增加队列并把队列分布到更多节点」——前者扩的是数据分片，后者扩的是独立队列的数量。
- **「副本」**：Kafka replica 是分区副本（有 Leader/Follower 与 ISR）；RabbitMQ Quorum 副本是 Raft 成员（多数派概念，无 ISR）；RocketMQ 主从是 Broker 级角色；Pulsar 的副本在 BookKeeper ledger 层（bookie 不区分 leader）。四者的故障切换方式与数据一致性窗口都不同。
- **「Broker 无状态」**：仅对 Pulsar 成立——其消息状态在 BookKeeper，Broker 宕机不丢数据；Kafka/RocketMQ 的 Broker 本身持有数据（或主从持有），RabbitMQ 节点持有队列数据。

## 相关页面

- 保留与回放的差异：[回放与保留](/matrix/replay-retention)
- 安全与租户隔离的配套：[安全](/matrix/security)
- 运维视角的扩缩容操作：[运维观测](/matrix/operations)
