# Apache Pulsar 存储与高可用

> 本页结论：Pulsar 计算存储分离——Broker 无状态只做服务，消息日志以 ledger 段形式按 quorum 写入 BookKeeper，元数据独立存放；这让计算与存储可以各自扩展，但**不消灭容量约束**：bookie 磁盘、quorum 参数与 backlog 仍然要做规划。

## 存储模型：managed ledger → ledger → entry

- 每个 Topic（分区）背后是一个 **managed ledger**：一串只追加的 **ledger（段）**，消息以 **entry** 为单位追加写入。
- ledger 写满（大小/时间滚动）后封口（sealed），新写入开新 ledger；封口后的 ledger 只读、可独立迁移与卸载。
- 消费**不删除数据**：订阅 cursor 只是位点，删除只由 TTL/retention 决定——这是回放的基础（对比见 [消息模型](/fundamentals/models)）。

## BookKeeper quorum：多数派持久化

写入一条 entry 时，BookKeeper 按三个参数决定分布与确认（以 E=5、Qw=3、Qa=2 的常见配置示意）：

| 参数 | 含义 | 作用 |
| :--- | :--- | :--- |
| Ensemble size（E） | 一个 ledger 可选的 bookie 池大小 | 把负载摊到更多节点 |
| Write quorum（Qw） | 每条 entry 复制到几个 bookie | 副本数，决定存储冗余 |
| Ack quorum（Qa） | 几个 bookie 确认即算写入成功 | 确认强度：Qa 个副本持久化成功才返回；容忍 Qw−Qa 个慢/坏节点不阻塞写入 |

- 确认语义：**发送成功 = entry 已在 Qa 个 bookie 持久化**；只要存活的副本满足读要求，数据可读——类似 Kafka ISR 的「多数派」思想，但副本单位是 ledger 段而不是整个分区。
- bookie 故障：未封口的 ledger 可在其他 bookie 上恢复续写；已封口 ledger 的读取在剩余副本间完成。
- 本仓库 standalone 内嵌**单 bookie**：只演示写入路径与确认语义，不演示 bookie 故障（多节点故障注入属 L3，默认不执行）。

## Broker 无状态

- Broker 不存消息、不存 cursor：Topic 归属（ownership）记录在元数据服务，cursor 也持久化在元数据服务。
- Broker 崩溃/滚动升级：Topic 由其他 Broker 接管，消费者重连后从 cursor 继续——扩容 Broker 不需要搬数据。
- 元数据服务（实验为 ZooKeeper）是可用性关键：生产环境独立部署、奇数节点。

## TTL vs Retention（互不等价）

| 策略 | 行为 | 默认 | 典型用途 |
| :--- | :--- | :--- | :--- |
| TTL（message_ttl_in_seconds） | 到期即删，**不管是否被消费** | 0 = 永不过期 | 时效性消息，过期无价值 |
| Retention（时间/大小） | 在 TTL 之外**额外保留**数据（含未消费的 backlog） | 0 = 不额外保留 | 回放、审计、事件溯源 |

- 策略以 **Namespace** 为单位设置（`pulsar-admin namespaces set-retention` 等）。
- 关键关系：**backlog 是保留的前提**——retention 保证未消费数据不被提前删除；回放的前提则是数据仍在保留窗口内（backlog 过大 + retention 过短 = 真的错过消息，见 [背压与积压](/fundamentals/backpressure)）。
- 另有 backlog quota：给 Namespace 的积压量设上限，超限可选拒绝写入或按策略淘汰——这是消费跟不上时的显式背压手段。

## Tiered Storage（offload）简介

- 当 ledger 达到阈值（大小/时间），可把老 ledger **offload** 到对象存储（S3/GCS/Azure/HDFS 等），bookie 回收本地磁盘。
- 读取透明：消费者读到已卸载的段时自动从分层存储拉取，代价是延迟升高。
- 适用：长保留 + 低成本（冷数据进对象存储），不适合把热路径延迟当基准。

## 多租户与扩展

- **Cluster → Tenant → Namespace → Topic**：配额、TTL/retention、backlog quota、授权、geo-replication（跨集群复制）都以 Namespace 为单位配置。
- **扩计算**：加 Broker，Topic bundle 重新分配即可利用新算力。
- **扩存储**：加 bookie，新 ledger 分布到新节点；**旧数据不会自动搬迁**（可结合 offload/人工迁移）。
- 容量下限估算：保留窗口 × 每日写入量 × 写副本系数（Qw）÷ 磁盘安全水位。「存算分离 = 免容量规划/无限容量」是禁止表述——分离改变的是扩容方式，不是消灭约束（见 [陷阱](/brokers/pulsar/pitfalls)）。

## 常见误区

- 「Broker 挂了消息就丢」——日志在 BookKeeper，cursor 在元数据服务；换 Broker 接管即可继续。
- 「消费完的消息还占着磁盘」——删除由 TTL/retention 决定，与消费进度无关；但 backlog 未清前 retention 会护住它。
- 「加了 bookie 旧数据就摊匀了」——新 ledger 才用新节点，历史 ledger 留在原处。
- 「standalone 就是小型生产集群」——单 broker + 单 bookie + 内嵌元数据，没有冗余可言，仅限实验。

## 官方资料

- Architecture Overview（BookKeeper/ledger）：<https://pulsar.apache.org/docs/next/concepts-architecture-overview>（checkedAt: 2026-08-19）
- Message Retention and Expiry：<https://pulsar.apache.org/docs/next/cookbooks-retention-expiry>（checkedAt: 2026-08-19）
- Tiered Storage：<https://pulsar.apache.org/docs/next/tiered-storage-overview>（checkedAt: 2026-08-19）
- Geo-replication：<https://pulsar.apache.org/docs/next/concepts-replication>（checkedAt: 2026-08-19）
