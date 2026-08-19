# Redis Streams 存储与高可用

> 本页结论：Stream 条目存在内存里，安全性由持久化（RDB/AOF）与复制策略决定；ACK 不删除条目，保留靠 XTRIM/MAXLEN/MINID。单个 Stream key 不会自动分裂成多 Broker 分区日志——这是它与 Kafka 最本质的扩展模型差异。

## 存储模型

- 条目保存在 Redis 内存中（radix tree + listpack/quicklist 编码），因此**容量受单实例内存约束**。
- Entry ID 单调递增；`XADD` 时可用 `MAXLEN ~ N` 或 `MINID ~ <id>` 顺带裁剪，控制上界。

## 保留策略与「消费 ≠ 删除」

| 机制 | 触发 | 影响 |
| :--- | :--- | :--- |
| `XACK` | 消费者确认 | 只移出该组 PEL；条目仍在 |
| `XTRIM MAXLEN ~ N` | 手动或随 XADD | 删除最老条目；**所有组**都受影响 |
| `XTRIM MINID ~ <id>` | 手动 | 删除某 ID 之前的条目（按时间裁剪） |
| 无裁剪 | 默认 | 无限增长直到内存上限/驱逐 |

被裁剪的条目如果还在某组 PEL 中：PEL 引用保留，`XCLAIM` 时会得到「entry deleted」——**保留策略与确认状态是两套独立状态**（规格 §7.5 强调点）。

> 与 Kafka 对比：Kafka 按分区有独立的 retention 配置且消费者位点不影响删除；Redis Streams 的裁剪是 key 级全局的，激进裁剪会让慢组直接丢数据。

## 持久化：RDB 与 AOF 决定崩溃后剩多少

| 模式 | 语义 | 消息安全 |
| :--- | :--- | :--- |
| 无持久化 | 纯内存 | 进程崩溃即全丢 |
| RDB 快照 | 周期性快照 | 丢最近一次快照之后的写入 |
| AOF `everysec` | 每秒 fsync | 最多丢约 1 秒写入（常用折中） |
| AOF `always` | 每条命令 fsync | 最安全，吞吐代价最大 |

本仓库实验 compose 使用 `--appendonly yes`（默认 `everysec`）演示落盘语义；生产上「消息能不能丢」由这里的配置回答，而不是 Streams API 本身。

## 复制与高可用

- **主从复制是异步的**：`XADD` 返回不等待副本；主节点崩溃 + 自动故障切换可能丢失最后一段未复制条目（含 PEL 与消费位点）。
- Sentinel / Redis Cluster 提供故障切换，但**不改变异步复制的丢失窗口**；要求更强可用 `WAIT` + 业务补偿。
- Redis Cluster 按 key 做哈希槽分布：不同 Stream key 落在不同节点，可以水平分散负载；但**单个 Stream key 只在一个槽、一个节点上**，它的吞吐与容量不会随集群扩容而增长。

## 扩展边界（与 Kafka 对比）

| 维度 | Redis Streams | Kafka |
| :--- | :--- | :--- |
| 并行单元 | key（应用层自行拆分） | Partition（Broker 内自动分布） |
| 单日志吞吐上限 | 单节点 | 分区数 × Broker 数 |
| 扩容方式 | 更多 key / Cluster 分槽 | 增加分区与 Broker |
| 回放 | XRANGE/XGROUP SETID（受保留限制） | Offset seek（受 retention 限制） |

结论：把「一个超热业务流」塞进单个 Stream key，等于把吞吐上限锁死在单节点；需要更大规模时按业务键拆 key（自建分区语义），或换用分区日志产品（见 [选型指南](/matrix/selection-guide)）。

## 官方资料

- Stream 存储与裁剪：<https://redis.io/docs/latest/commands/xtrim/>（checkedAt: 2026-08-19）
- 持久化：<https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/>（checkedAt: 2026-08-19）
- 复制：<https://redis.io/docs/latest/operate/oss_and_stack/management/replication/>（checkedAt: 2026-08-19）
