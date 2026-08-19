# 选型指南

> 本页结论：消息产品选型是约束求解，不是选冠军。给定「消息规模/顺序/回放/延迟/事务/团队熟悉度」等输入，可以推导出候选（不超过 2 个）、权衡、必须验证的风险和最小 PoC 清单；不存在任何场景都最优的万能冠军。

版本基线见[矩阵总览](/matrix/)（checkedAt: 2026-08-19）。本页对应 spec §8.2「选型矩阵」与 §8.3 的输入 → 输出格式。

## 没有万能冠军

- RabbitMQ 的灵活路由与队列语义，换不来日志回放；
- Kafka 的回放与吞吐生态，换不来 Broker 内置重试与延迟消息；
- RocketMQ 的业务消息全家桶（FIFO/Delay/Transaction/内置重试），不等于流处理与多租户平台；
- Pulsar 的存算分离与多租户，伴随更高的部署组件与运维复杂度。

任何「某某全面碾压某某」的结论都忽略了约束。下面是推导方法。

## 第一步：输入维度表

对照业务勾选每个维度（✅ 强需求 / 🔶 有需求但可妥协 / ➖ 无需求）：

| 输入维度 | 关键问题 | 指向 |
| :--- | :--- | :--- |
| 消息规模与形态 | 任务型少量消息、海量事件流，还是海量 Topic/多租户平台？ | [规模分档](#规模分档) |
| 顺序需求 | 是否要求按业务 Key（如 orderId）有序？顺序失败时能否容忍挂起？ | [顺序矩阵](/matrix/ordering) |
| 回放需求 | 是否需要长期保留并按任意位点回放？ | [回放与保留](/matrix/replay-retention) |
| 延迟/定时需求 | 是否需要原生延迟消息？量级与精度要求？ | [延迟/定时消息](/matrix/delayed-messages) |
| 事务需求 | 是否需要「本地事务 ⇔ 消息投递」原子，或集群内 EOS 管道？ | [投递语义](/matrix/delivery-semantics) |
| 重试/DLQ 诉求 | 是否希望 Broker 内置重试与死信，而不是应用层自建？ | [重试与 DLQ](/matrix/retry-dlq) |
| 路由需求 | 是否需要模式/内容路由（按事件类型分发到不同消费者）？ | [投递语义](/matrix/delivery-semantics) |
| 团队熟悉度 | 已有哪种运维能力：RabbitMQ/Kafka 团队、大数据平台团队、云原生团队？ | [团队熟悉度](#团队熟悉度) |
| 资源与复杂度预算 | 能接受多少组件（元数据服务、存储集群、镜像仓库）与学习成本？ | [复杂度对比](#复杂度对比) |

## 第二步：按维度筛选候选

### 规模分档

| 场景 | 候选与理由 |
| :--- | :--- |
| 低延迟任务队列（单消息 ACK、少量队列、万级 TPS 内） | RabbitMQ 首选：队列语义与 prefetch 天然匹配；Pulsar Shared 可作备选但部署更重 |
| 海量事件流/日志管道（持久化、多消费组、高吞吐） | Kafka 首选：提交日志 + 回放；Pulsar 备选：需要存算分离或多租户时 |
| 海量 Topic / 多租户平台（按业务方隔离、配额管理） | Pulsar 首选：Tenant/Namespace 原生多租户；其他三者均无对等层级（见[存储与高可用](/matrix/storage-ha-scaling)） |
| 业务消息中台（顺序 + 延迟 + 事务 + 内置重试都要） | RocketMQ 首选：四类消息类型 + Broker 内置重试/DLQ；Kafka 需全部应用层自建 |

### 顺序需求

| 输入 | 候选与权衡 |
| :--- | :--- |
| 需要按业务 Key 有序 + 高并行 | Kafka（partition key）、RocketMQ（MessageGroup）、Pulsar（Key_Shared）三者皆可；RabbitMQ 需把 key 映射成独立队列，规模化困难 |
| 顺序消息消费失败时不能阻塞后续消息 | 避开 FIFO 挂起语义（RocketMQ FIFO 会挂起顺序组）；选 Kafka 位点前移 + 旁路重试，或 RocketMQ 普通消息 + 重试队列 |
| 只需要少量严格有序的任务流 | RabbitMQ 单队列最简单 |

### 回放需求

| 输入 | 候选与权衡 |
| :--- | :--- |
| 需要任意位点回放 + 长期保留 | Kafka / Pulsar / RocketMQ（保留期内）；RabbitMQ 不适用（ACK 即删） |
| 回放 + 冷数据低成本归档 | Kafka（Tiered Storage 需插件）与 Pulsar（offloader 到对象存储）更成熟，见[回放与保留](/matrix/replay-retention) |
| 多订阅各自独立回放历史 | Kafka（多 Consumer Group）/ Pulsar（多 Subscription）最自然 |

### 延迟/事务需求

| 输入 | 候选与权衡 |
| :--- | :--- |
| 需要原生延迟/定时消息 | RocketMQ 首选（Delay 类型 + 投递时间戳）；RabbitMQ TTL+DLX 可近似但精度受限；Kafka/Pulsar 需业务自建 |
| 需要「本地事务 ⇔ 消息投递」原子 | RocketMQ 事务消息（Half Message + 回查） |
| 需要集群内 consume-transform-produce 的 EOS | Kafka 事务（幂等 + EOS，边界仅限 Kafka 内部） |
| 需要跨分区原子写 | Pulsar Transactions / Kafka 事务 |
| 跨外部数据库的「分布式事务」 | 四者都不直接提供：一律用 Outbox + 幂等消费落地（见[模式](/patterns/outbox)） |

### 团队熟悉度

| 已有能力 | 倾向 |
| :--- | :--- |
| 熟悉 Java 应用运维、已有 RabbitMQ 经验、重路由需求 | 继续 RabbitMQ，除非出现回放/海量流需求 |
| 大数据/流处理团队，已有 Kafka 运维体系 | 继续 Kafka；为「内置重试/延迟」引入第二个 Broker 前，先评估应用层模式成本 |
| 电商/交易类业务团队 | RocketMQ 的业务消息特性与运维工具匹配度高 |
| 云原生平台团队，需多租户与弹性 | Pulsar，但必须评估 BookKeeper + 元数据服务的运维投入 |

### 复杂度对比（资源预算视角）

| 产品 | 最小生产形态的组件复杂度 | 说明 |
| :--- | :--- | :--- |
| RabbitMQ | 低：单节点/3 节点 Quorum | 队列级复制，资源按队列规模增长 |
| Kafka | 中：Broker + KRaft 控制器 | 分区副本 + 磁盘容量规划 |
| RocketMQ | 中：namesrv + broker（+ proxy） | 5.x 架构组件较多，见[概念映射](/brokers/rocketmq/concepts) |
| Pulsar | 高：Broker + BookKeeper + 元数据服务 | 存算分离换来弹性，代价是组件与调优面更大 |

## 第三步：输出格式（每个选型结论必须包含）

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

### 示例：订单系统的事件链

- **输入**：需要按 orderId 有序；需要延迟消息做超时关单；需要事务消息保证下单落库与发消息原子；无需长期回放；团队熟悉 Java。
- **推荐候选**：RocketMQ。
- **推荐原因**：FIFO（MessageGroup）+ Delay + Transaction 消息 + Broker 内置重试/%DLQ% 一次性覆盖四项需求（各矩阵：[顺序](/matrix/ordering)、[延迟](/matrix/delayed-messages)、[投递语义](/matrix/delivery-semantics)、[重试与 DLQ](/matrix/retry-dlq)）。
- **必须验证的风险**：FIFO 消费失败挂起顺序组的阻塞影响；事务回查接口的实现正确性；namesrv+broker+proxy 的运维成本。
- **最小 PoC 清单**：同 orderId 三条消息顺序消费；一条失败消息进重试与 %DLQ%；一条延迟消息准点投递；一次本地事务回滚后消息不投递。

### 示例：数据平台的事件接入

- **输入**：海量事件、多消费组、需要按时间戳回放修复下游、团队已有 Kafka 运维能力。
- **推荐候选**：Kafka（Pulsar 仅在需要多租户/存算分离时备选）。
- **推荐原因**：提交日志 + offset/时间戳回放 + 消费组生态（见[回放与保留](/matrix/replay-retention)）。
- **必须验证的风险**：无内置消费重试/DLQ，需在应用层或框架中实现；分区数与消费者数的扩容规划；热点 key 分区倾斜。
- **最小 PoC 清单**：同 key 有序验证；消费者崩溃后位点回退重读；按时间戳回放一天数据；acks=all + 幂等生产下的重复率观测。

## 通用风险验证清单（任何候选都要过）

1. 重复：at-least-once 下幂等消费是否拦截全部重复（[实验](/labs/consumer-crash)）。
2. 顺序：失败重试后业务完成顺序是否符合预期（[实验](/labs/ordering)）。
3. 毒消息：一条坏消息是否会循环重投或阻塞顺序单元（[实验](/labs/poison-message)）。
4. 积压：消费者离线再恢复，追赶耗时与 Broker 资源占用（[实验](/labs/backlog-recovery)）。
5. 副本：少数派节点故障时的可用性与数据完整性（各产品 storage-ha 页）。
6. 默认值陷阱：对照各产品[陷阱与检查表](/brokers/rabbitmq/pitfalls)。

## 相关页面

- 各维度矩阵：[投递语义](/matrix/delivery-semantics) · [顺序](/matrix/ordering) · [重试与 DLQ](/matrix/retry-dlq) · [延迟/定时消息](/matrix/delayed-messages) · [回放与保留](/matrix/replay-retention) · [存储与高可用](/matrix/storage-ha-scaling) · [安全](/matrix/security) · [运维观测](/matrix/operations)
- 返回：[矩阵总览](/matrix/)
