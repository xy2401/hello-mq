# Hello MQ 项目详细规格说明书

> 文档状态：Draft v1.0  
> 目标仓库：`hello-mq`（独立仓库）  
> 文档用途：产品范围、信息架构、Demo 规范、自动验证、质量门禁与版本路线的统一实施依据  
> 工程基线：统一知识骨架 + 横向矩阵 + 可运行 Demo + 固定环境快照 + VitePress 展示

---

## 1. 项目定义

### 1.1 一句话定位

`hello-mq` 是一套面向开发者与架构师的消息队列、事件流平台和可靠消息模式知识库：用统一实验场景解释消息系统的核心语义，用可运行的容器化 Demo 验证关键结论，并用横向矩阵说明不同产品的能力边界与选型依据。

### 1.2 项目愿景

让读者不只会“启动一个 Broker 并发送 Hello World”，还能够回答以下问题：

- 为什么系统需要异步消息，而不是继续增加同步 RPC？
- 队列、发布订阅、分布式日志和事件流分别解决什么问题？
- 消息“发送成功”“持久化成功”“消费成功”是三个什么样的状态？
- at-most-once、at-least-once 与 exactly-once 到底保证了哪一段链路？
- 如何处理重复、乱序、积压、毒消息、重试风暴与消费者崩溃？
- RabbitMQ、Kafka、RocketMQ、Pulsar、Redis Streams、NATS JetStream 应该如何选？
- 如何用 Outbox、幂等消费、Saga 等模式把消息语义落到业务一致性上？
- 如何观测、压测、扩容和安全地运行消息系统？

### 1.3 工程结构原则

`hello-mq` 使用统一、可扩展的知识与验证结构，让每个消息产品都能够按相同维度学习、运行和比较。

| 结构模式 | `hello-mq` 对应实现 |
| :--- | :--- |
| 产品独立分卷 | 每个消息产品拥有完整且一致的内容目录 |
| 统一知识骨架 | 所有产品按相同的十二个公共维度讲解 |
| 产品能力演进 | 说明重要版本中的架构、协议与功能变化 |
| 横向概念矩阵 | 对比跨产品语义、能力、边界与选型条件 |
| Docker 实验快照 | Docker Compose Broker + Producer/Consumer 实验快照 |
| 交互式可视化 | 展示消息拓扑、投递轨迹与故障过程 |

### 1.4 仓库边界

`hello-mq` 必须作为独立仓库创建。原因如下：

- Broker 容器、网络、数据卷与故障实验需要独立的工程与运行边界。
- 消息产品版本、客户端依赖与 CI 资源需求需要独立管理。
- 文档、实验和产品版本需要拥有独立发布节奏。

---

## 2. 目标、非目标与受众

### 2.1 核心目标

1. 建立一套不依赖特定产品术语的消息系统基础知识骨架。
2. 对核心产品使用同一业务场景和同一组实验进行验证。
3. 明确区分“规范保证、配置条件、客户端行为、业务端补偿”。
4. 所有关键行为尽可能由可重复执行的 Docker 实验与快照支持。
5. 给出能落地的可靠消息设计、可观测性、安全和选型指导。
6. 保持中文主叙述，首次出现的核心术语附英文原名。

### 2.2 非目标

- 不把项目做成厂商文档的完整中文翻译。
- 不承诺覆盖所有消息中间件、云服务和所有客户端语言。
- 不将本地单节点 Demo 的吞吐数字包装成生产基准结论。
- 不把“恰好一次”描述成跨任意数据库和外部副作用的绝对保证。
- 不提供生产集群的一键部署平台；Kubernetes/Helm 只讲架构与操作原则。
- 不默认执行高资源占用、多节点或破坏性故障实验。
- 不收录没有官方资料或可复现实验证据支持的营销数字。

### 2.3 目标读者

| 读者 | 主要诉求 | 推荐路径 |
| :--- | :--- | :--- |
| 后端初学者 | 理解队列、发布订阅、ACK、重试 | 基础概念 → RabbitMQ → 基础实验 |
| Java/服务端开发者 | 可靠投递、幂等、事务一致性 | 可靠性 → Outbox → Kafka/RocketMQ |
| 架构师 | 产品边界、容量模型、选型 | 横向矩阵 → 架构 → 选型指南 |
| SRE/平台工程师 | 积压、扩缩容、监控、故障恢复 | 运维分卷 → 故障实验 → Runbook |
| 数据/流处理开发者 | 分区日志、回放、消费组 | Kafka/Pulsar → 顺序与回放矩阵 |

### 2.4 完成学习后的能力

读者应能够：

- 画出 producer、broker、topic/queue、consumer、subscription/group 的数据流。
- 为一条业务消息定义唯一标识、路由键、分区键、Schema 版本和追踪字段。
- 解释生产确认与消费确认的差异，并配置最小可用可靠链路。
- 用幂等表或业务唯一约束抵御重复消费。
- 设计有限次数、指数退避、抖动和 DLQ 隔离的重试策略。
- 根据顺序、回放、延迟消息、路由、吞吐、多租户和运维成本选型。
- 通过指标判断消费者积压、重投递异常、分区不均与磁盘压力。

---

## 3. 产品范围与分期

### 3.1 首期核心产品（P0）

| 产品 | 在知识体系中的代表性 | 首期必须覆盖的重点 |
| :--- | :--- | :--- |
| RabbitMQ | 传统消息队列与灵活路由 | Exchange/Queue/Binding、Direct/Topic/Fanout、Publisher Confirms、Consumer ACK、Prefetch、Quorum Queue、TTL/DLX |
| Apache Kafka | 分区式持久日志与事件流 | Topic/Partition/Replica、Consumer Group、Offset、Key 顺序、Retention/Compaction、Idempotent Producer、Transaction、KRaft |
| Apache RocketMQ | 面向业务消息的分布式中间件 | Topic/MessageQueue、Consumer Group、Tag、FIFO、Delay、Transaction Message、Retry/DLQ、NameServer/Broker |
| Apache Pulsar | 存储计算分离、云原生多租户消息与流 | Tenant/Namespace/Topic、Broker/BookKeeper、四类 Subscription、Ack/Redelivery、Transaction、Geo-replication、Tiered Storage |

### 3.2 轻量扩展产品（P1）

| 产品 | 纳入原因 | 内容边界 |
| :--- | :--- | :--- |
| Redis Streams | 展示 Redis 内的追加日志、Consumer Group 与 Pending Entries List | 只讲 Streams，不把 Redis Pub/Sub 当作可靠队列；明确持久化、复制与单 Stream 扩展边界 |
| NATS + JetStream | 展示低延迟 Core NATS 与持久化 JetStream 的分层语义 | 必须分开讲 Core NATS 与 JetStream；覆盖 Subject、Queue Group、Stream、Consumer、ACK、Retention 与 Replay |

### 3.3 后续候选（P2）

- ActiveMQ Artemis：JMS/AMQP 企业消息生态。
- MQTT Broker（EMQX/Mosquitto）：IoT 弱网、QoS 与会话模型。
- Redpanda：Kafka API 兼容实现与单二进制架构。
- 云厂商服务：AWS SQS/SNS/MSK、Google Pub/Sub、Azure Service Bus/Event Hubs、阿里云消息队列等。
- 流处理生态：Kafka Streams、Flink、Pulsar Functions，只作为消息系统下游扩展，不挤占首期主线。

### 3.4 明确暂不纳入

- 每个产品的全部管理控制台截图教程。
- 各语言客户端的全量 API 对照。
- 未经统一环境控制的产品性能排行榜。
- 云厂商费用计算器和地域可用性清单；这类信息变化快，应链接官方页面而不是硬编码。

---

## 4. 统一知识模型

### 4.1 十二个公共讲解维度

每个核心产品分卷必须按以下顺序回答，避免各写各的：

1. **定位与适用场景**：它首先是队列、日志、事件流还是多模型平台。
2. **核心实体**：Producer、Broker、Topic/Queue、Subscription/Group、Message/Record。
3. **路由与分发**：绑定、路由键、分区键、Subject、Tag、订阅模式。
4. **存储与保留**：消息何时落盘、保留多久、消费后是否删除、能否回放。
5. **生产可靠性**：发送确认、批处理、重试、幂等生产、超时与不确定状态。
6. **消费可靠性**：ACK/Offset、可见性、重投递、Pending、消费超时。
7. **投递语义**：at-most-once、at-least-once、exactly-once 的具体作用范围。
8. **顺序语义**：全局/队列/分区/Key/单消费者顺序，以及失败重试对顺序的影响。
9. **失败处理**：重试间隔、最大次数、DLQ、毒消息、人工回放。
10. **高可用与扩展**：复制、Leader/Quorum、分区、存储节点、扩缩容影响。
11. **安全与可观测性**：认证、授权、TLS、审计、核心指标、Tracing 传播。
12. **限制与反模式**：默认值陷阱、错误类比、不适用场景、生产检查表。

### 4.2 三层语义说明法

每项“保证”必须拆成三层，禁止只写一个结论：

| 层级 | 要回答的问题 | 示例 |
| :--- | :--- | :--- |
| Broker 层 | 服务端在什么条件下接受、复制、保留或重投消息？ | 达到副本确认条件后才确认生产成功 |
| Client 层 | SDK 的超时、重试、ACK、Offset 和事务如何配置？ | 超时后重试可能造成重复，需要幂等生产或业务去重 |
| Business 层 | 数据库写入、外部 API、邮件等副作用如何保持一致？ | 用 Outbox + 幂等消费者，不把 Broker 事务夸大为跨系统事务 |

### 4.3 统一术语表要求

`docs/reference/glossary.md` 至少包含：

- Message / Record / Event / Command
- Queue / Topic / Stream / Partition / MessageQueue
- Exchange / Binding / Routing Key / Subject / Tag
- Consumer / Subscription / Consumer Group / Queue Group
- ACK / NACK / Offset / Cursor / Pending / Visibility
- Retention / Compaction / Replay / Redelivery
- Publisher Confirm / Idempotence / Transaction / Deduplication
- Retry / Backoff / Jitter / Dead Letter Queue / Parking Lot Queue
- Throughput / End-to-end Latency / Consumer Lag / Backpressure
- Leader / Replica / Quorum / ISR / Bookie

每个术语需给出“中性定义、各产品对应名、不可直接等价之处”。

### 4.4 关键纠偏原则

- Publisher Confirm 与 Consumer ACK 是互相独立的两段确认。
- “消息不丢”必须附带前置条件和故障范围。
- at-least-once 意味着业务必须预期重复，而不是“偶尔可能重复”。
- 单分区/单队列内顺序不等于端到端业务完成顺序。
- Kafka 的 exactly-once 应说明其事务边界；写入外部数据库仍需额外设计。
- RabbitMQ DLX、Kafka Retry Topic、RocketMQ Retry/DLQ 不能写成相同的原生机制。
- Redis Streams 的 Consumer Group 与 Kafka Consumer Group 功能相似但实现和扩展模型不同。
- Core NATS 的易失消息语义与 JetStream 的持久化消费语义必须分开。
- “已消费”可能表示 ACK、Offset 已提交或游标前移，不一定代表业务副作用绝对成功。

---

## 5. 统一教学案例与消息契约

### 5.1 主案例：电商订单事件链

所有产品使用同一条主线，减少业务差异对产品比较的干扰：

```text
Order Service
    │ OrderCreated.v1
    ▼
Message Broker / Event Stream
    ├── Inventory Consumer  -> reserve stock
    ├── Points Consumer     -> add points
    └── Notification Consumer -> send notification
```

实验中必须能切换以下情景：

- 正常生产与消费。
- 两个同组消费者竞争消费。
- 两个独立订阅分别接收同一事件。
- 同一 `orderId` 的有序消息。
- 消费者在处理前/处理后、ACK 前崩溃。
- 毒消息进入重试与 DLQ。
- 消费者离线后积压，再恢复追赶。
- 重复投递被幂等逻辑拦截。
- 保留期内从指定位置回放（产品支持时）。

### 5.2 标准事件信封

```json
{
  "messageId": "01JMQ000000000000000000001",
  "eventType": "order.created",
  "schemaVersion": 1,
  "occurredAt": "2026-01-01T00:00:00.000Z",
  "producer": "order-service",
  "traceId": "00000000000000000000000000000001",
  "correlationId": "order-1001",
  "aggregateType": "order",
  "aggregateId": "order-1001",
  "contentType": "application/json",
  "payload": {
    "orderId": "order-1001",
    "customerId": "customer-42",
    "amount": 199.00,
    "currency": "CNY"
  }
}
```

### 5.3 消息契约规则

- `messageId` 全局唯一，是幂等消费的主键候选。
- `eventType` 使用小写点分命名；不得用队列名代替业务语义。
- `schemaVersion` 是正整数；破坏性变更升级版本。
- `occurredAt` 使用 UTC ISO 8601。
- `traceId` 与 `correlationId` 必须穿过 Producer、Broker Header 和 Consumer 日志。
- `aggregateId` 默认作为需要按业务实体有序时的路由/分区键。
- 金额示例在真实代码中不得使用二进制浮点进行财务计算；Demo 可使用 decimal/整数分值。
- Schema 文件放入 `demos/shared/contracts/`，至少提供 JSON Schema。
- Consumer 必须容忍新增可选字段；文档必须展示一次兼容演进和一次破坏性演进。

### 5.4 幂等消费基准实现

所有核心产品至少实现一次通用幂等消费者：

1. 开启本地数据库事务。
2. 尝试将 `messageId` 插入 `processed_messages` 唯一键表。
3. 如果唯一键冲突，记录 `duplicate_skipped` 并安全确认消息。
4. 如果首次处理，执行业务写入并提交本地事务。
5. 数据库提交成功后才提交 ACK/Offset。

必须同时解释崩溃窗口：数据库提交成功、Broker 确认前崩溃会导致重投，因此幂等表不可省略。

---

## 6. 信息架构与目录结构

### 6.1 建议仓库结构

```text
hello-mq/
├── .github/
│   └── workflows/
│       ├── docs.yml                 # 文档检查与构建
│       └── smoke-labs.yml           # P0 单节点短实验
├── compose/
│   ├── rabbitmq.compose.yml
│   ├── kafka.compose.yml
│   ├── rocketmq.compose.yml
│   ├── pulsar.compose.yml
│   ├── redis-streams.compose.yml
│   └── nats.compose.yml
├── demos/
│   ├── shared/
│   │   ├── contracts/
│   │   │   ├── order-created.v1.schema.json
│   │   │   └── order-created.v2.schema.json
│   │   ├── fixtures/
│   │   │   ├── order-1001.json
│   │   │   └── poison-message.json
│   │   └── idempotency-db/
│   ├── rabbitmq/
│   │   ├── basic/
│   │   ├── routing/
│   │   ├── reliability/
│   │   └── retry-dlq/
│   ├── kafka/
│   │   ├── basic/
│   │   ├── consumer-group/
│   │   ├── ordering-replay/
│   │   └── idempotence-transaction/
│   ├── rocketmq/
│   │   ├── basic/
│   │   ├── fifo-delay/
│   │   ├── transaction/
│   │   └── retry-dlq/
│   ├── pulsar/
│   │   ├── basic/
│   │   ├── subscriptions/
│   │   ├── redelivery-dlq/
│   │   └── transaction/
│   ├── redis-streams/
│   └── nats/
├── docs/
│   ├── .vitepress/
│   │   ├── config.ts
│   │   └── theme/
│   │       ├── components/
│   │       ├── data/
│   │       └── custom.css
│   ├── index.md
│   ├── guide/
│   │   ├── getting-started.md
│   │   ├── learning-path.md
│   │   └── lab-conventions.md
│   ├── fundamentals/
│   │   ├── index.md
│   │   ├── why-messaging.md
│   │   ├── models.md
│   │   ├── delivery-semantics.md
│   │   ├── ordering.md
│   │   ├── storage-and-replay.md
│   │   └── backpressure.md
│   ├── brokers/
│   │   ├── rabbitmq/
│   │   ├── kafka/
│   │   ├── rocketmq/
│   │   ├── pulsar/
│   │   ├── redis-streams/
│   │   └── nats/
│   ├── patterns/
│   │   ├── work-queue.md
│   │   ├── pub-sub.md
│   │   ├── request-reply.md
│   │   ├── outbox.md
│   │   ├── idempotent-consumer.md
│   │   ├── retry-and-dlq.md
│   │   ├── saga.md
│   │   └── schema-evolution.md
│   ├── matrix/
│   │   ├── index.md
│   │   ├── terminology.md
│   │   ├── routing-and-consumption.md
│   │   ├── delivery-semantics.md
│   │   ├── ordering-and-replay.md
│   │   ├── retry-delay-dlq.md
│   │   ├── transactions.md
│   │   ├── storage-ha-scaling.md
│   │   ├── operations.md
│   │   └── selection-guide.md
│   ├── operations/
│   │   ├── observability.md
│   │   ├── security.md
│   │   ├── capacity-planning.md
│   │   ├── failure-playbook.md
│   │   └── production-checklist.md
│   ├── labs/
│   │   ├── index.md
│   │   ├── basic-flow.md
│   │   ├── consumer-crash.md
│   │   ├── poison-message.md
│   │   ├── backlog-recovery.md
│   │   └── ordering.md
│   ├── reference/
│   │   ├── glossary.md
│   │   ├── version-policy.md
│   │   ├── evidence-policy.md
│   │   └── sources.md
│   └── public/
│       └── logo.svg
├── outputs/                         # 自动生成并提交的实验快照
│   ├── rabbitmq/
│   ├── kafka/
│   ├── rocketmq/
│   └── pulsar/
├── scripts/
│   ├── lab.js                       # 实验统一入口
│   ├── check-project.js
│   ├── normalize-output.js
│   └── wait-for-service.js
├── .env.example                     # 参数说明，不含秘密
├── .env.versions                    # 提交并锁定镜像版本/摘要
├── .gitignore
├── docker-compose.yml               # 可选聚合入口，仅引用 profile
├── package.json
├── package-lock.json
├── README.md
└── LICENSE
```

### 6.2 每个核心产品分卷的页面模板

每个 `docs/brokers/<product>/` 至少包含：

```text
index.md              # 定位、架构图、学习路径、能力摘要
quick-start.md        # 最短闭环：启动、生产、消费、清理
concepts.md           # 用该产品术语映射统一知识模型
routing.md            # 路由、分区、订阅与负载均衡
reliability.md        # 确认、重试、幂等、顺序和事务边界
storage-ha.md         # 存储、复制、高可用与扩展
operations.md         # 指标、管理命令、安全与常见故障
pitfalls.md           # 默认值、错误做法与生产检查表
```

允许产品按特性增加页面，但不可删掉公共维度；不适用项需明确写“不适用及原因”。

### 6.3 文档页面写作模板

```markdown
# 页面标题

> 本页结论：一句话说明读者将学会什么。

## 适用场景
## 核心模型/拓扑
## 最小配置
## 可运行示例
## 正常流程
## 故障流程
## 保证成立的条件
## 不保证什么
## 观测指标
## 常见误区
## 实验复现命令
## 官方资料与版本说明
```

---

## 7. 产品分卷的强制内容

### 7.1 RabbitMQ

必须覆盖：

- Virtual Host、Connection、Channel、Exchange、Queue、Binding 的关系。
- Default/Direct/Topic/Fanout/Headers Exchange 的路由差异。
- Classic Queue、Quorum Queue、Stream 的定位，不把三者混成一种队列。
- Durable Queue、Persistent Message、Publisher Confirm 的不同职责。
- 自动 ACK 与手动 ACK，ACK/NACK/Reject、Requeue 和 Prefetch。
- Publisher Confirms 与 Consumer Acknowledgements 的独立性。
- TTL、Dead Letter Exchange、最大长度与毒消息隔离。
- Quorum Queue 基于多数派复制时的可用性与延迟权衡。
- 至少一个“消费者 ACK 前崩溃后重新投递”的实验。
- 至少一个 Topic Exchange 路由与一个 DLX 实验。

禁止表述：

- “队列 durable + 消息 persistent 就绝对不丢”。
- “Publisher Confirm 表示消费者已经处理”。
- “所有 RabbitMQ 队列都适合超长积压或日志回放”。

### 7.2 Apache Kafka

必须覆盖：

- Broker、Topic、Partition、Replica、Leader、Consumer Group、Offset。
- Partition Key 如何决定局部顺序与负载分布。
- Consumer Group 内分区分配、再均衡及消费者数量上限的基本关系。
- Retention 与 Log Compaction 的区别；消费并不删除日志记录。
- `acks`、副本条件、Producer Retry、Idempotent Producer 的关系。
- 自动/手动提交 Offset 造成的丢失或重复窗口。
- Transactional Producer、Read Committed 与 Kafka 内部 exactly-once 边界。
- KRaft 元数据架构；新内容不再以 ZooKeeper 作为默认主线。
- Retry Topic/DLQ 通常是应用或框架模式，不描述成统一的 Broker 内置消费重试。
- 至少一个同 Key 有序、一个 Consumer Group 扩缩容、一个 Offset 回放实验。

禁止表述：

- “Kafka 保证全局顺序”。
- “提交 Offset 等于业务数据库已成功提交”。
- “开启事务后，任意外部系统副作用都是 exactly-once”。

### 7.3 Apache RocketMQ

必须覆盖：

- NameServer、Broker、Topic、MessageQueue、Producer/Consumer Group。
- Normal、FIFO、Delay、Transaction 等消息类型及 Topic 约束。
- Tag/Key 的不同用途：过滤、索引/检索与业务关联。
- PushConsumer、SimpleConsumer 的消费与确认差异。
- 消费失败重试、最大次数与 DLQ 的状态过程。
- FIFO 的 Message Group/队列级顺序边界以及失败阻塞风险。
- Transaction Message 的 Half Message、本地事务、二次确认和事务回查。
- 事务消息保证最终一致性的边界；下游仍需可靠消费和幂等。
- 至少一个延迟消息、一个 FIFO、一个事务回查实验。

禁止表述：

- “事务消息就是分布式强一致事务”。
- “发送 SDK 最终失败代表 Broker 一定没有收到”。
- “重试机制可以用作日常限流手段”。

### 7.4 Apache Pulsar

必须覆盖：

- Cluster、Tenant、Namespace、Topic、Partition、Subscription。
- Broker 服务层与 BookKeeper/Bookie 存储层的职责边界。
- Exclusive、Shared、Failover、Key_Shared 四类订阅的差异。
- Durable/Non-durable Subscription、Cursor、Individual/Cumulative ACK。
- Redelivery、Negative ACK、Ack Timeout、Retry Letter/DLQ。
- Key_Shared 与 Key 有序处理的约束。
- 多租户、Geo-replication、Tiered Storage 的适用场景。
- Transactions 的跨 Topic/Partition 原子操作范围。
- 至少一个四订阅类型对比和一个消费位置重置/回放实验。

禁止表述：

- “Pulsar 的 Topic 天然没有分区概念”。
- “存储计算分离意味着无需做容量规划”。
- “Shared Subscription 保证同 Key 顺序”。

### 7.5 Redis Streams（P1）

必须覆盖：

- `XADD`、Entry ID、`XREAD`、`XRANGE`、`XTRIM`。
- `XGROUP`、`XREADGROUP`、`XACK`、Pending Entries List、`XPENDING`、`XAUTOCLAIM`。
- 单 Stream 多 Consumer Group，以及组内消费者负载分发。
- Stream 条目保留与 PEL 引用不是同一件事。
- Redis 持久化/复制策略会影响消息安全，不能只看 Streams API。
- 单个 Stream Key 不会自动变成 Kafka 式多 Broker 分区日志。

### 7.6 NATS 与 JetStream（P1）

必须覆盖：

- Core NATS 的 Subject、Wildcard、Publish/Subscribe、Queue Group、Request/Reply。
- Core NATS 的低延迟易失语义与断线窗口。
- JetStream 的 Stream、Subject 映射、Consumer、Storage、Retention、Replay、ACK。
- Durable/Ephemeral、Push/Pull Consumer。
- Core NATS 与 JetStream 的发送 API 和可靠性目标不可混写。

---

## 8. 横向矩阵规格

### 8.1 矩阵编写原则

- 每个单元格最多先给一句结论，再链接详细说明。
- 用“原生支持 / 需要组合配置 / 客户端或框架实现 / 业务实现 / 不适用”五级标记。
- 每项能力附最小前置条件，禁止只打勾或打叉。
- 对不同语义的同名功能增加脚注，不强行归一。
- 所有时效性强的结论记录产品文档版本与核对日期。

### 8.2 必须存在的矩阵

1. **术语映射矩阵**：Queue、Topic、Partition、Subscription、Consumer Group 等。
2. **消息模型矩阵**：竞争消费、广播、分区日志、请求响应。
3. **路由矩阵**：Routing Key、Partition Key、Tag、Subject、Key_Shared。
4. **确认与投递矩阵**：生产确认、消费确认、重投递、去重。
5. **顺序与回放矩阵**：最小顺序单元、回放能力、位置控制。
6. **重试/延迟/DLQ 矩阵**：原生机制、外部模式、顺序影响。
7. **事务矩阵**：事务涉及的资源、原子边界、外部系统限制。
8. **存储与保留矩阵**：消费删除、时间/大小保留、Compaction、Tiered Storage。
9. **高可用与扩展矩阵**：复制单元、故障容忍、扩容粒度、多租户。
10. **运维矩阵**：管理工具、关键指标、Schema 生态、安全能力。
11. **选型矩阵**：低延迟任务队列、复杂路由、事件回放、大规模流、多租户、业务延迟/事务消息。

### 8.3 选型输出格式

选型页不能给“万能冠军”，必须按约束生成建议：

```text
需求输入
├── 是否需要长期保留和任意回放？
├── 是否需要复杂内容/模式路由？
├── 是否要求按业务 Key 有序？
├── 是否需要原生延迟或事务消息？
├── 是否有海量 Topic 与多租户需求？
├── 团队已有何种运维能力？
└── 能接受怎样的资源和复杂度成本？

输出
├── 推荐候选（不超过 2 个）
├── 推荐原因
├── 必须验证的风险
└── 最小 PoC 实验清单
```

---

## 9. Demo 与实验规范

### 9.1 客户端语言

P0 的跨产品标准 Demo 使用 **Java 21**，原因是六个目标产品均有成熟 Java 客户端，且 Java 是消息中间件常见生产语言。管理与诊断可使用产品官方 CLI。

约束：

- 同一实验在不同产品中保持相同输入、日志字段与退出码。
- 使用产品官方或官方推荐客户端；依赖版本必须锁定。
- Java 代码采用 Maven 多模块或 Gradle 多模块中的一种，首版建议 Maven。
- 不在首版同时维护 Python、Go、Node.js 等多语言等价实现。
- 后续语言扩展放入 `demos/<product>/clients/<language>/`，不改变标准 Demo。

### 9.2 实验分级

| 等级 | 类型 | 默认执行 | 示例 |
| :--- | :--- | :--- | :--- |
| L0 | 静态检查 | 是 | Schema、链接、Compose 配置、脚本语法 |
| L1 | 单节点冒烟 | 是 | 启动 Broker、发 3 条、收 3 条、校验结果 |
| L2 | 可靠性行为 | 本地可选，CI 分产品执行 | 重投、DLQ、回放、同 Key 顺序 |
| L3 | 多节点故障 | 否，手动确认 | Leader/节点停止、Quorum 丢失、恢复 |
| L4 | 性能与容量 | 否，独立工作流 | 固定环境基准、积压恢复、消息大小曲线 |

### 9.3 统一命令接口

```bash
npm install
npm run docs:dev
npm run docs:build
npm run check

# 列出产品与实验
npm run lab -- list

# 执行单个实验
npm run lab -- rabbitmq basic
npm run lab -- kafka consumer-crash

# 执行某产品全部 L1/L2 实验
npm run lab -- rocketmq all

# 收集或核验快照
npm run collect-outputs -- kafka
npm run verify-outputs

# 清理该产品实验资源；不得误删其他项目容器/卷
npm run lab -- rabbitmq clean
```

### 9.4 实验生命周期

统一入口 `scripts/lab.js` 必须执行：

1. 校验产品名、实验名与危险等级。
2. 解析 `.env.versions`，拒绝未锁定的 `latest` 镜像。
3. 使用项目名隔离的 Compose Project 启动目标产品。
4. 轮询产品健康检查，不使用固定长时间 `sleep`。
5. 创建 Topic/Queue/Subscription 等实验资源。
6. 启动 Consumer，再运行 Producer；特殊实验按声明编排。
7. 收集客户端输出、Broker 诊断信息与关键状态。
8. 运行断言，输出明确的 PASS/FAIL。
9. 正常路径自动停止容器；仅在显式 `--keep` 时保留现场。
10. 清理范围仅限当前 Compose Project 和带项目前缀的资源。

### 9.5 输出快照格式

```text
---
status: verified
product: kafka
lab: consumer-crash
brokerVersion: "<locked-version>"
image: "<repository:tag@sha256:digest>"
client: "java-<locked-version>"
capturedAt: "<ISO-8601>"
durationMs: 1234
exitCode: 0
assertions:
  received: 3
  duplicatesObserved: 1
  duplicatesApplied: 0
---
[producer] messageId=... status=confirmed
[consumer] messageId=... attempt=1 status=business_committed
[consumer] messageId=... attempt=2 status=duplicate_skipped
[assert] business_rows=1 PASS
```

快照提交前必须归一化：随机容器名、端口、时间戳、动态 Message ID、主机路径和 ANSI 颜色。原始调试日志不直接提交；必要时作为 CI artifact 保存。

### 9.6 实验断言

禁止仅用“进程退出码为 0”代表实验成功。至少断言：

- 生产端确认的消息数量。
- 消费端收到的消息数量与唯一 `messageId` 数量。
- 业务落库行数。
- 重投递次数或 Delivery Attempt。
- ACK/Offset/PEL/Consumer Lag 等产品状态。
- DLQ 中消息数与原消息关联字段。
- 同 Key 消息的观察顺序。
- 失败注入确实发生，而不是测试路径没有触发。

### 9.7 故障注入安全规则

- L3/L4 默认不进入 `npm run check`。
- 停止、暂停或断网只能作用于 Compose Project 内已解析出的容器名。
- 删除数据卷前必须打印精确卷名并要求 `--confirm-destructive`。
- 不使用 Docker 全局 prune。
- 不绑定公网端口；管理界面默认仅映射到 `127.0.0.1`。
- Demo 密码仅用于本地，并在 `.env.example` 明确标为不可用于生产。

---

## 10. 展示层与交互组件

### 10.1 技术栈

- VitePress + Vue 3 构建文档站点和交互组件。
- Mermaid 用于架构、时序、状态机与故障时间线。
- 自定义组件只解决 Markdown 难以表达的交互，不复制完整管理控制台。
- 主题支持暗色/亮色与移动端阅读。

### 10.2 必需组件

| 组件 | 用途 | 最小能力 |
| :--- | :--- | :--- |
| `LabOutput` | 展示已验证实验快照 | 状态、镜像、版本、时长、断言、日志、复制命令 |
| `MessageTrace` | 展示单消息端到端轨迹 | Producer → Broker → Consumer → DB，各阶段状态 |
| `TopologyDiagram` | 交互解释 Queue/PubSub/Partition | 切换模式、高亮消息流，不连接真实 Broker |
| `CapabilityMatrix` | 横向能力表 | 筛选产品/维度、脚注、证据链接、移动端折叠 |
| `ConfigDiff` | 展示可靠/不可靠配置差异 | Before/After、风险标记、版本适用范围 |
| `VersionBadge` | 标记内容核对版本 | 产品版本、核对日期、官方来源 |

### 10.3 首页结构

1. Hero：消息队列、事件流与可靠消息模式大典。
2. 三条入口：基础学习、产品分卷、横向选型。
3. 六个产品定位卡片。
4. 一张从同步调用到事件驱动的交互拓扑。
5. 一个“消费者崩溃后重投 + 幂等拦截”的真实快照。
6. 核心矩阵速览。
7. 本地实验 Quick Start。

### 10.4 导航建议

顶部导航控制在 7 项以内：

- 首页
- 基础原理
- 产品全典（下拉）
- 可靠消息模式
- 横向矩阵
- 运维实践
- 实验室

产品详细页面放入侧边栏，避免把大量分卷全部平铺在顶部导航。

---

## 11. 版本、证据与内容治理

### 11.1 版本策略

- 不使用 `latest`、`edge`、`nightly` 等浮动镜像标签。
- `.env.versions` 同时记录镜像 Tag 和 Digest。
- P0 默认选择实施时仍受支持、官方文档完整、可在本地单节点运行的稳定版本。
- 文档中的 API、配置和行为必须标注适用产品版本。
- 升级 Broker 时先在独立分支更新镜像、客户端和快照，再修改文档结论。
- 每季度检查官方支持版本；发生安全问题时立即检查。
- “当前最新”“默认值”等时效性表述必须带核对日期。

建议格式：

```dotenv
RABBITMQ_IMAGE=rabbitmq:<pinned-management-tag>@sha256:<digest>
KAFKA_IMAGE=<official-kafka-image>:<pinned-tag>@sha256:<digest>
ROCKETMQ_IMAGE=apache/rocketmq:<pinned-tag>@sha256:<digest>
PULSAR_IMAGE=apachepulsar/pulsar:<pinned-tag>@sha256:<digest>
REDIS_IMAGE=redis:<pinned-tag>@sha256:<digest>
NATS_IMAGE=nats:<pinned-tag>@sha256:<digest>
```

实际建仓时必须从官方发布页核对可用 Tag，不能原样保留占位符。

### 11.2 证据等级

| 等级 | 证据 | 可支持的内容 |
| :--- | :--- | :--- |
| E1 | 官方规范、官方文档、官方 Release Notes | 产品语义、配置、支持范围 |
| E2 | 仓库内固定版本可重复实验 | 已观察行为、日志与状态变化 |
| E3 | 官方工程博客/设计文档 | 设计背景与实践建议，需注明上下文 |
| E4 | 第三方文章或个人经验 | 仅作补充，不支撑关键保证 |

可靠性、事务、数据安全与故障恢复结论必须至少有 E1；可以执行验证的关键路径同时提供 E2。

### 11.3 官方资料基线

首版 `docs/reference/sources.md` 至少维护以下入口及核对日期：

- RabbitMQ Documentation：`https://www.rabbitmq.com/docs`
- Apache Kafka Documentation/Design：`https://kafka.apache.org/documentation/`
- Apache RocketMQ Documentation：`https://rocketmq.apache.org/docs/`
- Apache Pulsar Documentation：`https://pulsar.apache.org/docs/`
- Redis Streams Documentation：`https://redis.io/docs/latest/develop/data-types/streams/`
- NATS Documentation：`https://docs.nats.io/`

### 11.4 内容事实检查清单

- 是否把营销描述改写成可验证的技术边界？
- 是否说明版本、配置和前置条件？
- 是否区分生产确认、Broker 持久化、消费确认和业务提交？
- 是否写明故障发生在哪个时间窗口？
- 是否区分原生功能、客户端功能、框架模式和业务代码？
- 是否有官方来源？可实验的结论是否有快照？
- 是否避免跨产品的错误同义词替换？
- 是否写明不保证什么？

---

## 12. 可观测性、安全与生产实践

### 12.1 统一指标模型

每个核心产品必须映射到以下指标：

- Producer：发送速率、确认延迟、错误/超时/重试率、批大小。
- Broker：入站/出站速率、存储大小、磁盘/内存/网络、连接、不可用分区/副本状态。
- Consumer：消费速率、处理延迟、失败率、重投率、活跃消费者数。
- Backlog：Queue Depth、Consumer Lag、Subscription Backlog、Pending Entries。
- DLQ：新增速率、存量、最老消息年龄、回放成功率。
- Business：端到端事件年龄、重复拦截数、业务应用成功数。

至少给出一个“消息积压定位决策树”：生产突增、消费者变慢、消费者离线、分区不均、毒消息循环、Broker 限流。

### 12.2 Trace 与日志字段

统一日志必须包含：

```text
timestamp level service product lab
messageId eventType schemaVersion aggregateId
traceId correlationId destination partitionOrQueue
consumerGroup consumer attempt redelivered
status durationMs errorType
```

Tracing 页面需解释消息异步边界中的上下文注入/提取、Producer Span、Consumer Span，以及重试消息是否延续或链接原 Trace。

### 12.3 安全基线

- 生产环境启用 TLS，验证服务端身份；双向 TLS 作为可选强化。
- 每个服务使用独立身份，按 Topic/Queue/Subject 最小授权。
- 禁止在仓库、URL、日志和快照中提交秘密。
- 管理端口与数据端口分离并限制网络访问。
- 对消息 Payload 中的个人信息、凭证、支付数据进行分类和脱敏。
- 说明“传输加密、静态加密、应用层字段加密”的边界。
- 记录管理操作与权限变更；给出证书/密钥轮换提示。
- Demo 的默认账号必须在生产检查表中明确标记为禁止项。

### 12.4 容量与压测规范

任何性能结果都必须记录：

- CPU、内存、磁盘类型、操作系统、Docker 版本。
- Broker/客户端版本与完整关键配置。
- 节点数、副本数、分区/队列数、生产者/消费者数。
- 消息大小、批大小、压缩、确认级别、持久化条件。
- 热身时间、测试时长、P50/P95/P99、错误率。
- 是否发生 GC、页缓存升温、磁盘写满或限流。

报告标题必须使用“该固定环境下的实验结果”，不得使用“产品绝对性能排名”。

---

## 13. 工程质量与 CI

### 13.1 `package.json` 脚本

```json
{
  "scripts": {
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:preview": "vitepress preview docs",
    "check:project": "node scripts/check-project.js",
    "check:compose": "docker compose config --quiet",
    "check": "npm run check:project && npm run docs:build",
    "lab": "node scripts/lab.js",
    "collect-outputs": "node scripts/lab.js collect",
    "verify-outputs": "node scripts/lab.js verify"
  }
}
```

`check:compose` 在没有 Docker 的文档环境中可单独跳过，但主 CI 必须执行。

### 13.2 `check-project.js` 最低检查项

- README 与所有 Markdown 的内部链接有效。
- VitePress 导航/侧边栏链接存在。
- 每个 `LabOutput` 引用的快照存在且状态合法。
- 所有快照含产品、实验、版本、镜像摘要、退出码与断言。
- `.env.versions` 不含 `latest`，核心镜像包含 Digest。
- Compose 文件可解析，服务名不冲突，管理端口只绑定 localhost。
- JSON Schema 与 fixture 校验通过。
- Java 标准 Demo 格式化、编译和单元测试通过。
- 不提交 `.class`、`.jar`、Broker 数据目录、秘密和原始大日志。
- 产品分卷包含公共页面；矩阵覆盖所有 P0 产品。
- 官方链接条目包含 `checkedAt` 日期。
- 脚本通过语法检查。

### 13.3 CI 分层

```text
Pull Request
├── L0 static-check
├── docs-build
├── java-unit-test
└── compose-validate

Main / Nightly Matrix
├── rabbitmq L1/L2
├── kafka L1/L2
├── rocketmq L1/L2
└── pulsar L1/L2

Manual Workflow
├── multi-node failure labs
├── performance labs
└── snapshot refresh
```

产品实验使用 CI Matrix 隔离执行，避免一次启动全部 Broker。每个 Job 设置超时并在失败时上传 Compose 日志。

### 13.4 快照更新规则

- 普通 PR 的实验采用“与已提交断言比较”，不自动提交新快照。
- 镜像或客户端升级 PR 必须显式刷新快照，并由 Reviewer 审查语义变化。
- `capturedAt` 等非语义字段不应导致整页噪声 Diff。
- 若官方行为与实验不一致，先标记问题与环境，不为了让测试通过而改写结论。

---

## 14. README 规格

根 `README.md` 应包含：

1. 项目标题、副标题与核心定位说明。
2. 核心特色：统一语义骨架、6 产品分卷、11 大矩阵、真实故障实验、可靠消息模式。
3. 产品覆盖清单与 P0/P1 状态。
4. 目录结构。
5. 环境要求：Node.js、Docker Engine/Compose、建议内存与磁盘。
6. 最短启动流程。
7. 单产品实验命令。
8. 资源与安全提示。
9. 贡献方式与证据政策。
10. MIT License。

建议副标题：

> **全主流消息队列、事件流平台、可靠消息模式与横向选型大典 (Message Queue & Event Streaming Explorer)**

---

## 15. 实施路线图

### Phase 0：仓库骨架与规范门禁

交付：

- VitePress、主题、导航、Logo、README、License。
- `.env.versions`、Compose 约定、`scripts/lab.js` 框架。
- 基础术语、证据政策、版本政策。
- 链接/快照/版本/Compose 静态检查。

退出条件：`npm run check` 通过；空实验框架能列出产品和实验。

### Phase 1：基础原理 + RabbitMQ

交付：

- 消息模型、确认、投递语义、顺序、重试/DLQ 基础文档。
- RabbitMQ 完整分卷。
- Basic、Routing、Consumer Crash、Retry/DLQ 四个实验。
- `LabOutput` 与 `MessageTrace` 组件。

退出条件：读者可从零启动 RabbitMQ，复现重投与幂等消费。

### Phase 2：Kafka

交付：

- Kafka 完整分卷。
- Partition Ordering、Consumer Group、Offset Replay、Transaction 实验。
- RabbitMQ vs Kafka 第一版矩阵。

退出条件：顺序、回放、消费组和 exactly-once 边界均有文档与证据。

### Phase 3：RocketMQ + Pulsar

交付：

- 两个产品完整分卷。
- RocketMQ FIFO/Delay/Transaction 实验。
- Pulsar Subscription/Redelivery/Replay 实验。
- 四核心产品完整横向矩阵与选型页。

退出条件：P0 公共维度、Demo、矩阵无缺项。

### Phase 4：可靠消息模式与生产实践

交付：

- Outbox、幂等消费、Saga、Schema Evolution。
- Observability、Security、Capacity、Failure Playbook。
- 毒消息、积压恢复、Schema 兼容实验。

退出条件：不仅能使用产品，还能完成端到端业务可靠性设计。

### Phase 5：Redis Streams + NATS JetStream

交付：

- P1 两产品精简分卷与基础实验。
- 六产品矩阵更新。
- 轻量级场景选型说明。

退出条件：P1 内容不降低 P0 文档和 CI 的维护质量。

---

## 16. 验收标准（Definition of Done）

### 16.1 项目级验收

- [ ] `hello-mq` 是可独立安装、构建和发布的仓库。
- [ ] README 清晰解释定位、覆盖范围、目录和 Quick Start。
- [ ] P0 四产品均有完整公共页面模板。
- [ ] 基础原理、可靠消息模式、运维和横向矩阵导航闭环。
- [ ] `npm run check` 在干净环境通过。
- [ ] 所有核心镜像与客户端版本锁定，无 `latest`。
- [ ] 关键可靠性结论均有官方来源，适合实验的结论有验证快照。
- [ ] 所有 Demo 使用同一消息契约和结构化日志字段。
- [ ] CI 不同时启动全部 Broker，资源和超时受控。

### 16.2 单产品验收

- [ ] 完成十二个公共讲解维度。
- [ ] 有架构图、正常时序图和至少一个故障时序图。
- [ ] 有从启动到清理的 Quick Start。
- [ ] Basic、可靠性、产品特色至少三个实验通过。
- [ ] 明确列出保证成立条件和不保证范围。
- [ ] 关键术语已映射到统一词汇表。
- [ ] 运维页包含指标、诊断命令、安全和常见故障。
- [ ] 矩阵中该产品的所有单元格均有结论或“不适用”说明。

### 16.3 单实验验收

- [ ] 可重复执行，第二次运行不会被上次资源污染。
- [ ] 使用固定输入或可归一化输入。
- [ ] 健康检查基于轮询和超时。
- [ ] 至少一个业务级断言，不只检查进程退出码。
- [ ] 输出包含版本、镜像摘要、实验名和断言。
- [ ] 失败时保留足够诊断信息，成功时自动清理。
- [ ] 清理只影响当前项目命名空间。
- [ ] 文档能一键复制复现命令。

### 16.4 内容验收

- [ ] 中文表达准确，英文术语首次出现时给出原名。
- [ ] 没有“绝对不丢”“绝对有序”“天然 exactly-once”等无条件断言。
- [ ] 没有把框架/客户端能力误写为 Broker 原生能力。
- [ ] 没有用单机实验数字做跨产品生产性能排名。
- [ ] 所有时效性结论包含版本或核对日期。
- [ ] 官方引用直接指向支撑该结论的页面。

---

## 17. 首版风险与控制措施

| 风险 | 影响 | 控制措施 |
| :--- | :--- | :--- |
| 同时维护四个重型 Broker | CI 慢、开发机资源不足 | 分产品 Compose 与 CI Matrix；首版按 Phase 递增 |
| 产品术语看似相同但语义不同 | 教程产生错误类比 | 中性术语层 + 产品映射 + “不可等价”脚注 |
| exactly-once 被过度承诺 | 业务一致性设计错误 | 强制三层语义说明和外部副作用边界 |
| Demo 随机输出导致快照不稳定 | PR 噪声、测试脆弱 | 固定 fixture、结构化日志、归一化脚本 |
| 镜像浮动造成行为漂移 | 无法复现 | Tag + Digest 双锁定，升级专门 PR |
| Docker 故障实验误伤本机资源 | 数据或环境受损 | Compose Project 隔离、精确目标、危险操作显式确认 |
| 官方文档持续更新 | 内容过时 | 版本徽章、`checkedAt`、季度审查 |
| 产品控制台占用大量维护成本 | 偏离核心知识目标 | 首版只使用官方管理工具，不自建完整控制台 |

---

## 18. 建仓时的第一批任务

建议严格按以下顺序创建首批 Issue：

1. 初始化仓库、VitePress、License、README 与基础 CI。
2. 建立版本锁定、Compose Project 命名和安全清理约定。
3. 定义 `OrderCreated.v1` Schema、fixture 与统一日志格式。
4. 实现 `scripts/lab.js` 的 list/up/wait/run/assert/down 生命周期。
5. 实现 `LabOutput`、快照解析和 `check-project.js`。
6. 编写 Fundamentals 六篇基础文档。
7. 完成 RabbitMQ Basic 与 Consumer Crash 实验。
8. 完成 RabbitMQ Routing 与 Retry/DLQ 实验。
9. 编写 RabbitMQ 完整分卷并接入官方来源。
10. 以 RabbitMQ 为样板冻结单产品页面模板。
11. 按 Kafka → RocketMQ → Pulsar 的顺序扩展。
12. 四产品稳定后再引入 Redis Streams 与 NATS JetStream。

---

## 19. 最终成功判据

`hello-mq` 的成功不以“收录了多少产品”衡量，而以以下结果衡量：

- 初学者能通过统一案例理解不同消息模型。
- 开发者能亲手复现 ACK、重复、重试、DLQ、顺序和回放。
- 架构师能看懂保证的边界，并基于约束而不是流行度选型。
- SRE 能从指标和故障时间线判断积压与可靠性问题。
- 文档中的关键结论可追溯到官方资料和固定版本实验。
- 新产品可以套用统一模板加入，而不会破坏已有比较维度。

当上述条件成立时，`hello-mq` 才真正实现其核心价值：不是堆砌概念，而是建立一套可比较、可运行、可验证、可持续维护的技术知识系统。
