# 横向矩阵总览

> 本页结论：横向矩阵只回答「在什么条件下各产品如何实现某项能力」，不回答「谁更好」。每个单元格 = 五级标记 + 一句结论 + 详情链接；所有结论核对日期 checkedAt: 2026-08-19。

本章节对八个产品做同维度横向比较：四个 P0——**RabbitMQ、Kafka、RocketMQ、Pulsar**，两个 P1——**Redis Streams、NATS（Core + JetStream）**，两个 P2——**ActiveMQ Artemis**（分卷与实验编排已就绪，快照未采集，矩阵单元格以官方文档为依据）与 **ActiveMQ Classic**（3 个实验快照已采集，矩阵单元格以实验快照与官方文档为依据）。阅读前建议先看对应产品分卷的[总览](/products/rabbitmq/)与[核心概念映射](/products/rabbitmq/concepts)，矩阵不重复讲解概念本身。

## 矩阵阅读方法

1. **先看标记，再看结论**：五级标记表示能力的「实现层级」（原生还是需要拼装），不表示优劣。
2. **结论必须连着前置条件读**：任何「支持」都附带最小前置条件（配置、部署形态、订阅类型等），脱离条件的打勾没有意义。
3. **不给脱离场景的排名**：同一能力在不同场景下最优解不同。需要选型结论时，走[选型指南](/matrix/selection-guide)的「输入 → 输出」流程。
4. **留意脚注**：同名异义术语（事务、重试、分区、延迟消息等）一律加脚注说明各产品含义差异，不强行归一；完整对照见[统一术语表](/reference/glossary)。
5. **时效性**：产品行为随版本演进，所有时效性结论带核对日期（当前基线 checkedAt: 2026-08-19）。

### 版本基线（checkedAt: 2026-08-19）

| 产品 | 版本 | 分卷入口 |
| :--- | :--- | :--- |
| <ProductLogo product="rabbitmq" /> RabbitMQ | 4.1.4 | [/products/rabbitmq/](/products/rabbitmq/) |
| <ProductLogo product="kafka" /> Kafka | 4.3.1 | [/products/kafka/](/products/kafka/) |
| <ProductLogo product="rocketmq" /> RocketMQ | 5.5.0 | [/products/rocketmq/](/products/rocketmq/) |
| <ProductLogo product="pulsar" /> Pulsar | 4.2.4 | [/products/pulsar/](/products/pulsar/) |
| <ProductLogo product="redis" /> Redis Streams | 8.2.1 | [/products/redis-streams/](/products/redis-streams/) |
| <ProductLogo product="nats" /> NATS | 2.11.5 | [/products/nats/](/products/nats/) |
| ActiveMQ Artemis | 2.44.0 | [/products/artemis/](/products/artemis/) |
| ActiveMQ Classic | 6.2.0 | [/products/activemq-classic/](/products/activemq-classic/) |

镜像均以 tag+digest 双锁定，见 `.env.versions` 与[版本政策](/reference/version-policy)。

## 五级标记图例

| 标记 | 层级 | 含义 | 判定规则 |
| :---: | :--- | :--- | :--- |
| ✅ | 原生 | Broker/产品内置能力，按官方文档开启配置即可使用 | 能力代码在产品自身，不依赖第三方组件或自写逻辑 |
| 🔧 | 组合配置 | 需要组合多个原生特性或专门配置才能达到效果 | 全部由产品特性构成，但正确性取决于配置组合 |
| 🧩 | 客户端框架 | 由官方/社区客户端 SDK 或框架实现，非 Broker 能力 | 换个客户端，行为可能不复存在 |
| 🛠 | 业务实现 | 需要在业务代码或外部系统中自建 | 产品不提供该机制，只提供搭建它的原料 |
| ➖ | 不适用 | 该产品不提供此能力，或该概念在其模型中不成立 | 不打分、不强行类比；说明为什么不存在 |

判定顺序：先看能力由谁实现（Broker → 客户端 → 业务代码），再看是否需要额外组件或配置组合。禁止只打勾或打叉：每个 ✅ 后面都必须跟着前置条件。

## 编写原则（对应 spec §8.1）

| 原则 | 本章节的落实方式 |
| :--- | :--- |
| 每个单元格最多先给一句结论，再链接详细说明 | 单元格格式统一为「标记 + 一句结论 + `/products/<product>/<page>` 链接」 |
| 五级标记：原生支持 / 需要组合配置 / 客户端或框架实现 / 业务实现 / 不适用 | 见上图例与判定规则，全部单元格强制使用其一 |
| 每项能力附最小前置条件，禁止只打勾或打叉 | 结论句中包含条件（如「需启用 DeadLetterPolicy」「acks=all + min.insync.replicas」） |
| 对不同语义的同名功能增加脚注，不强行归一 | 各页脚注区说明差异，本页下方给出高频术语速览 |
| 时效性结论记录产品文档版本与核对日期 | 页首标注版本基线与 checkedAt: 2026-08-19 |

## 交互能力速览

下表为五大能力在八个产品中的实现层级速览（可点击单元格中的「证据」跳转详细页）；逐项结论与前置条件见各专题矩阵页。

<CapabilityMatrix
  :columns="['RabbitMQ 4.1.4', 'Kafka 4.3.1', 'RocketMQ 5.5.0', 'Pulsar 4.2.4', 'Redis Streams 8.2.1', 'NATS 2.11.5', 'Artemis 2.44.0', 'Classic 6.2.0']"
  :rows="[
    {
      capability: '端到端 exactly-once',
      cells: [
        { level: 'business', note: '幂等表 + 手动 ACK 组合', link: '/matrix/delivery-semantics' },
        { level: 'framework', note: '仅集群内 EOS（事务+幂等生产者）；跨系统仍需业务幂等', link: '/products/kafka/reliability' },
        { level: 'business', note: '事务消息只保证「最终投递」，业务端仍需幂等', link: '/matrix/delivery-semantics' },
        { level: 'business', note: '同上：依赖业务幂等表', link: '/matrix/delivery-semantics' },
        { level: 'business', note: '幂等表 + 手动 XACK 组合', link: '/matrix/delivery-semantics' },
        { level: 'business', note: 'JetStream 显式 Ack + 业务幂等表；Msg-Id 去重仅在重发窗口内', link: '/matrix/delivery-semantics' },
        { level: 'business', note: 'XA 事务只保证 Broker 内原子；跨系统仍需业务幂等', link: '/matrix/delivery-semantics' },
        { level: 'business', note: 'SESSION_TRANSACTED 事务消费只保证 Broker 内原子；跨系统仍需业务幂等', link: '/matrix/delivery-semantics' },
      ],
    },
    {
      capability: '顺序消息',
      cells: [
        { level: 'composed', note: '单队列 + 单消费者（prefetch=1）', link: '/matrix/ordering' },
        { level: 'native', note: '分区内有序；同 key 进同分区', link: '/playground/ordering' },
        { level: 'native', note: 'FIFO Topic + MessageGroup', link: '/matrix/ordering' },
        { level: 'composed', note: '分区 + Key_Shared/Exclusive 订阅', link: '/matrix/ordering' },
        { level: 'composed', note: '单 Stream 天然 FIFO（无分区）；组内并行消费会破坏处理顺序', link: '/matrix/ordering' },
        { level: 'composed', note: '单 Stream 有序（无分区）；顺序消费需单消费者', link: '/matrix/ordering' },
        { level: 'composed', note: '单队列 FIFO；同组有序需 _AMQ_GROUP_ID（同组串行单消费者）', link: '/matrix/ordering' },
        { level: 'composed', note: '单队列 FIFO；同组有序需 JMSXGroupID（Message Groups）', link: '/matrix/ordering' },
      ],
    },
    {
      capability: '内置重试与 DLQ',
      cells: [
        { level: 'composed', note: 'TTL + DLX 拼装，无原生重试计数', link: '/matrix/retry-dlq' },
        { level: 'business', note: 'Broker 不重试，业务代码自建', link: '/matrix/retry-dlq' },
        { level: 'native', note: 'Broker 内置重试策略 + %DLQ%', link: '/matrix/retry-dlq' },
        { level: 'composed', note: '客户端 DeadLetterPolicy（需 Shared/Key_Shared）', link: '/matrix/retry-dlq' },
        { level: 'composed', note: 'PEL + XCLAIM/XAUTOCLAIM 重领；DLQ 需业务转写另一 Stream', link: '/matrix/retry-dlq' },
        { level: 'composed', note: 'AckWait + MaxDeliver 原生重投；耗尽后丢弃，DLQ 需自建', link: '/matrix/retry-dlq' },
        { level: 'native', note: 'address-setting 重试（max-delivery-attempts+退避）+ dead-letter-address', link: '/matrix/retry-dlq' },
        { level: 'native', note: 'redeliveryPolicy（URL 声明、Broker 执行）+ 默认共享 ActiveMQ.DLQ（零配置）', link: '/matrix/retry-dlq' },
      ],
    },
    {
      capability: '延迟消息',
      cells: [
        { level: 'composed', note: 'TTL + DLX 近似', link: '/matrix/delayed-messages' },
        { level: 'business', note: '无内建，业务侧时间轮/状态表', link: '/matrix/delayed-messages' },
        { level: 'native', note: '任意精度定时投递（4.x+ 时间轮）', link: '/matrix/delayed-messages' },
        { level: 'business', note: '无内建（DelayedDelivery 仅分区级粗粒度）', link: '/matrix/delayed-messages' },
        { level: 'business', note: '无内建：常用 ZSET 到期表 + 轮询转出', link: '/matrix/delayed-messages' },
        { level: 'business', note: '无内建：需外部调度器到点发布', link: '/matrix/delayed-messages' },
        { level: 'native', note: '_AMQ_SCHED_DELAY 属性指定延迟毫秒数', link: '/matrix/delayed-messages' },
        { level: 'business', note: '无原生延迟投递（与 Artemis 不同），需业务侧到点重发', link: '/matrix/delayed-messages' },
      ],
    },
    {
      capability: '消息回放',
      cells: [
        { level: 'none', note: 'ACK 即删，无日志可回放', link: '/matrix/replay-retention' },
        { level: 'native', note: '按 offset/时间戳重置消费组位点', link: '/playground/ordering' },
        { level: 'native', note: '重置消费位点（mqadmin resetOffset）', link: '/matrix/replay-retention' },
        { level: 'native', note: 'reset-cursor 到 earliest/时间戳', link: '/matrix/replay-retention' },
        { level: 'native', note: 'XACK 不删除；新建消费组从 0-0 或按 Entry ID 重读（受 XTRIM 限制）', link: '/matrix/replay-retention' },
        { level: 'native', note: 'JetStream 按 sequence/时间戳创建新消费者回放', link: '/matrix/replay-retention' },
        { level: 'none', note: 'ack 即删，队列无日志可回放', link: '/matrix/replay-retention' },
        { level: 'none', note: '确认即删（KahaDB 只存未消费消息），无回放语义', link: '/matrix/replay-retention' },
      ],
    },
  ]"
  :footnotes="[
    '「事务」同名异义：Kafka 事务是跨分区原子写+读隔离；RocketMQ 事务消息是 Half Message+回查的最终投递保证；两者不可互相替代，见统一术语表。',
    '五级标记只回答实现层级，不回答优劣；每个单元格的前置条件以专题页为准。',
  ]"
/>

## 术语映射矩阵（spec §8.2 矩阵之一）

同一概念在不同产品中的名字与边界不同，比较前先对齐术语：

| 中性术语 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis | ActiveMQ Classic |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 存储消息的实体 | Queue（[concepts](/products/rabbitmq/concepts)） | Topic 的 Partition（[concepts](/products/kafka/concepts)） | CommitLog + MessageQueue 索引（[concepts](/products/rocketmq/concepts)） | Partition + BookKeeper ledger（[concepts](/products/pulsar/concepts)） | Stream：单 key 追加日志（[concepts](/products/redis-streams/concepts)） | JetStream Stream：File/Memory 存储（[concepts](/products/nats/concepts)） | Address 下的 Queue：journal 存储（[concepts](/products/artemis/concepts)） | Queue/Topic 目的地：KahaDB 存储（[concepts](/products/activemq-classic/concepts)） |
| 逻辑分类 | Exchange + Binding 决定去向，Queue 实际存储 | Topic | Topic | Topic | Stream key | Subject（层级通配 `*`/`>`） | Address（anycast/multicast 路由类型） | Queue/Topic 目的地（无 Exchange，按目的地名直连） |
| 顺序/并行的最小单元 | 单个 Queue | Partition | MessageGroup（FIFO）/ MessageQueue | Partition + 订阅类型 | 单个 Stream（无分区） | 单个 Stream（无分区） | 单个 Queue（或 Message Group 内） | 单个 Queue（或 Message Group JMSXGroupID 内） |
| 竞争消费单位 | 同一 Queue 上的多个 consumer | Consumer Group（组内瓜分分区） | Consumer Group（集群消费模式） | Subscription（Shared/Failover/Key_Shared） | Consumer Group（组内 XREADGROUP 竞争分发） | Core Queue Group / JetStream Consumer | 同一 Queue 上的多个 consumer（round-robin） | 同一 Queue 上的多个 consumer（竞争分发） |
| 独立订阅（广播） | 多条 Binding 到多个 Queue | 多个 Consumer Group 各自位点 | 广播消费模式 / 多个 Consumer Group | 多个 Subscription 各自游标 | 多个 Consumer Group 各自 last-delivered-id | 多个订阅者；JetStream 多个 Consumer 各自位点 | multicast Address 每订阅一个 Queue | Topic 上每个 durable subscription 各留一份 |
| 消费位点 | 不暴露位点（ACK 即删，无可回退游标） | Offset | Consumer Offset（可按时间重置） | Cursor（reset-cursor） | last-delivered-id + PEL（XGROUP SETID 可改） | Consumer sequence（DeliverPolicy 可定起点） | 不暴露位点（ack 即删，无可回退游标） | 不暴露位点（确认即删，无可回退游标） |
| 隔离边界 | Virtual Host | 无原生租户层级（ACL/Quota 组合） | 无原生租户层级（ACL） | Tenant / Namespace | 无原生租户层级（ACL/DB 编号弱隔离） | Account（原生多账号隔离） | 无原生租户层级（角色/地址 ACL） | 无原生租户层级（JAAS + 目的地 ACL） |

术语的中性定义与「不可直接等价之处」详见[统一术语表](/reference/glossary)。

## 同名异义术语速览（必读脚注）

| 术语 | 差异要点 |
| :--- | :--- |
| **事务** | Kafka = 日志内多分区原子写 + EOS；RocketMQ = Half Message + 本地事务 + 回查，保证「发送与本地事务原子」；Pulsar = 跨 Topic/Partition 原子操作；RabbitMQ = channel 级批量发布提交。四者都不等于跨数据库分布式事务。详见[投递语义](/matrix/delivery-semantics)。 |
| **重试** | RocketMQ 指 Broker 内置重投；RabbitMQ/Kafka 无内置消费重试，「重试」指 TTL+DLX 或应用层 retry topic 模式；Pulsar 指 negativeAck/ack 超时触发的重投。详见[重试与 DLQ](/matrix/retry-dlq)。 |
| **分区** | Kafka/Pulsar 的 Partition 是并行、顺序与复制的基本单位；RocketMQ 的 MessageQueue 是消费视角的逻辑队列（所有消息先写共享 CommitLog）；RabbitMQ 队列没有分区概念。详见[顺序](/matrix/ordering)。 |
| **延迟消息** | RocketMQ 指原生指定投递时间戳的消息类型；RabbitMQ 只有 TTL+DLX「过期后转发」的近似模式；Kafka/Pulsar 无内置，需业务自建。详见[延迟/定时消息](/matrix/delayed-messages)。 |
| **回放** | 指保留期内按位点重读历史（日志语义），不等于消费失败后的「重投递」（redelivery）。详见[回放与保留](/matrix/replay-retention)。 |

## 十一张矩阵与页面映射（spec §8.2）

| spec 矩阵 | 所在页面 |
| :--- | :--- |
| 1. 术语映射矩阵 | 本页 |
| 2. 消息模型矩阵 | [投递语义](/matrix/delivery-semantics) |
| 3. 路由矩阵 | [投递语义](/matrix/delivery-semantics) |
| 4. 确认与投递矩阵 | [投递语义](/matrix/delivery-semantics) |
| 7. 事务矩阵 | [投递语义](/matrix/delivery-semantics) |
| 5. 顺序与回放矩阵（顺序部分） | [顺序](/matrix/ordering) |
| 5. 顺序与回放矩阵（回放部分）+ 8. 存储与保留矩阵 | [回放与保留](/matrix/replay-retention) |
| 6. 重试/延迟/DLQ 矩阵（重试与 DLQ） | [重试与 DLQ](/matrix/retry-dlq) |
| 6. 重试/延迟/DLQ 矩阵（延迟） | [延迟/定时消息](/matrix/delayed-messages) |
| 9. 高可用与扩展矩阵 | [存储与高可用、扩展与并行](/matrix/storage-ha-scaling) |
| 10. 运维矩阵（安全能力部分） | [安全](/matrix/security) |
| 10. 运维矩阵（工具/指标/Schema 部分） | [运维观测](/matrix/operations) |
| 11. 选型矩阵 | [选型指南](/matrix/selection-guide) |

## 本章页面

- [投递语义](/matrix/delivery-semantics)：确认、重投、去重、三级语义与事务边界
- [顺序](/matrix/ordering)：最小顺序单元与失败重试对顺序的影响
- [重试与 DLQ](/matrix/retry-dlq)：内置重试、退避策略与毒消息隔离
- [延迟/定时消息](/matrix/delayed-messages)：原生定时、TTL+DLX 与业务自建
- [回放与保留](/matrix/replay-retention)：消费是否删除、保留策略与位点控制
- [存储与高可用、扩展与并行](/matrix/storage-ha-scaling)：复制协议、故障容忍、扩容粒度与多租户
- [安全](/matrix/security)：传输/静态加密、认证、授权与审计
- [运维观测](/matrix/operations)：管理工具、指标导出、积压观测与 Schema 生态
- [自带 CLI](/matrix/cli-tools)：镜像自带命令的 bin 规模、状态、建队列与收发闭环对照
- [选型指南](/matrix/selection-guide)：输入维度 → 候选与权衡，没有万能冠军
