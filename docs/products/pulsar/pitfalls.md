# Apache Pulsar 陷阱与检查表

> 本页结论：汇总 Pulsar 的默认值陷阱与「存算分离」带来的错误直觉，逐条反驳三条常见错误表述，并给出一份可逐项打钩的生产上线检查表。

## 默认值陷阱

| 默认/常见配置 | 陷阱 | 正确做法 |
| :--- | :--- | :--- |
| 订阅类型默认 Exclusive | 第二个消费者订阅同名订阅**立即冲突**；误以为能并行消费 | 需要竞争消费用 Shared，需要分片保序用 Key_Shared |
| TTL/retention 默认 0（永不过期、不额外保留） | backlog 与历史数据无限堆积，吃光 bookie 磁盘 | 按保留需求显式设置 TTL/retention，并用 backlog quota 限制积压 |
| 未配置 DeadLetterPolicy | Shared 订阅中失败消息无限重投，backlog 不降、错误刷屏 | `maxRedeliverCount` + DLQ 告警与处置流程 |
| 只靠 ackTimeout 处理失败 | 超时设长毒消息处理滞后，设短慢处理被误判重投 | 业务失败显式 `negativeAcknowledge` 立即重投，ackTimeout 只做兜底 |
| Producer 异步发送不处理回调 | 发送失败被静默吞掉 = 丢消息 | 处理 Future/回调 + 重试，重复交给幂等消费 |
| 分区数拍脑袋定 | 分区数决定 Shared/Key_Shared 并行度上限，且只能增不能减 | 按峰值消费速率与 key 分布评估；热点 key 先识别 |
| standalone 当小型生产用 | 单 broker + 单 bookie + 内嵌元数据，无任何冗余 | 生产三层分离部署（见 [存储与高可用](/products/pulsar/storage-ha)） |

## 错误类比与禁止表述

以下表述在本仓库视为错误：

1. **「Pulsar Topic 没有分区概念」**
   真相：Pulsar 有分区 Topic（partitioned topic），由 N 个非分区 Topic 组成；Producer 按 `hash(key)` 或轮转把消息分布到各分区，**顺序只在单分区内**。非分区 Topic 只是一种形态选择，不等于「没有分区概念」。分区数与 key 路由见 [订阅与分发](/products/pulsar/routing)。

2. **「存算分离 = 免容量规划/无限容量」**
   真相：BookKeeper 集群仍然要规划磁盘水位、quorum 参数（E/Qw/Qa）、ledger 保留与写入反压（backlog quota、broker 限流）。分离改变的是**扩容方式**——加 Broker 不用搬数据、加 bookie 独立扩存储——不是消灭容量约束。容量估算见 [存储与高可用](/products/pulsar/storage-ha)。

3. **「Shared 订阅 = 同 key 有序」**
   真相：Shared 在消费者间轮转分摊消息，**不保证任何顺序**，同 key 消息可能被不同消费者乱序处理。同 key 有序要用 Key_Shared（同 key 粘连同一消费者），或退化为单分区 + Exclusive/Failover（牺牲并行度）。四类型语义见 [订阅与分发](/products/pulsar/routing)，顺序总论见 [顺序语义](/concepts/ordering)。

其他常见错误类比：

- 「Subscription = Kafka Consumer Group」——都持有消费进度，但订阅绑定单个 Topic 且有四种分发语义；消费组可订阅多 Topic 且只有「组内瓜分」一种语义。
- 「Topic = 队列，ack 了就删」——ack 只移动 cursor，数据删除由 TTL/retention 决定；队列语义不可互译（见 [消息模型](/concepts/models)）。
- 「Broker 无状态 = 可以不关心 Broker 容量」——连接数、订阅扇出、消息编解码都消耗 Broker CPU/内存，计算层同样会饱和。

## 反模式清单

- 在需要同键顺序的 Topic 上用 Shared：乱序事故直到业务对账才暴露。→ Key_Shared 或单分区保序订阅。
- 无限制创建订阅：每个订阅一份 backlog，retention 必须护住最慢的订阅，存储与回放成本随之放大。→ 订阅纳入治理，废弃订阅及时删除。
- 毒消息无限重投不设 DLQ：一个坏消息拖垮整个订阅的处理速率。→ DeadLetterPolicy + 告警（[redelivery-replay 实验](/products/pulsar/reliability) 演示了正确出口）。
- 把 reset-cursor 当日常操作：每次回放都制造重复投递风暴。→ 回放前确认幂等，回放作为演练与验收手段。
- 把 standalone 单机数字当生产基准：本仓库单容器数字只用于行为验证，不代表任何吞吐/延迟基准。

## 生产上线检查表

- [ ] 订阅类型：按顺序与并行需求选定（Exclusive/Failover/Shared/Key_Shared），第二个消费者接入行为已验证。
- [ ] 消费端：individual ack 晚于业务事务提交；幂等表（messageId 唯一键）与业务写入同事务；重投场景已演练。
- [ ] 失败路径：DeadLetterPolicy 的 `maxRedeliverCount` 已设置；DLQ 有订阅、告警与处置流程。
- [ ] 顺序：同键有序需求用 Key_Shared 或单分区 + Exclusive/Failover；Shared 已明确「无序」预期。
- [ ] 分区：分区数按消费并行度与 key 分布评估；热点 key 已识别；了解分区只能增不能减。
- [ ] 存储：namespace 的 TTL/retention/backlog quota 显式设置；容量按「保留窗口 × 日写入 × Qw 副本」估算并留水位。
- [ ] 高可用：bookie quorum（E/Qw/Qa）满足容灾要求；Broker ≥2；元数据服务独立部署、奇数节点。
- [ ] 安全：TLS + 认证（JWT/OAuth2/证书）、tenant/namespace 级最小授权；管理 API（8080）不暴露公网。
- [ ] 观测：订阅 backlog、进出速率、storage size、bookie 写入延迟有看板；traceId 经 properties 贯穿两端日志。
- [ ] 版本：镜像 tag+digest 双锁、客户端版本锁定（参考 `.env.versions`；checkedAt: 2026-08-19）。

## 官方资料

- Messaging Concepts（订阅类型/DLQ/retention）：<https://pulsar.apache.org/docs/next/concepts-messaging>（checkedAt: 2026-08-19）
- Architecture Overview（Broker/BookKeeper 边界）：<https://pulsar.apache.org/docs/next/concepts-architecture-overview>（checkedAt: 2026-08-19）
- Retention and Expiry：<https://pulsar.apache.org/docs/next/cookbooks-retention-expiry>（checkedAt: 2026-08-19）
