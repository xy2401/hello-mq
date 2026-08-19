# Redis Streams 核心概念映射

> 本页结论：用 Redis Streams 的术语回答统一知识模型的十二个维度；同名概念（Consumer Group、ACK、retention）与其它产品的差异一律用脚注说明。

## 实体映射

| 统一模型 | Redis Streams | 说明 |
| :--- | :--- | :--- |
| Message / Record | Entry（条目） | Entry ID + 字段键值对；字段是字符串，载荷常放单个字段（本仓库用 `data` 字段存完整信封 JSON） |
| Topic / Partition | Stream key | 一个 key = 一条日志；**没有分区概念**，单 key 不分片（与 Kafka Partition 不等价） |
| Subscription / Consumer Group | Consumer Group | 独立消费位点 + 独立 PEL；同 Stream 多组互不影响 |
| Consumer | 具名 Consumer | 组内用名字标识（如 `consumer-1`），崩溃接管与 PEL 归属都以名字为准 |
| Offset / Cursor | last-delivered-id | 组级「已投递到哪个 Entry ID」；`XGROUP SETID` 可重置（回放/跳过） |
| ACK | `XACK` | 把条目从该组 PEL 移除；**不删除 Stream 条目** |
| Visibility / Pending | PEL（Pending Entries List） | 已投递未 ACK 的条目清单，含投递次数与空闲时长 |

## 核心命令速查

| 操作 | 命令 |
| :--- | :--- |
| 写入 | `XADD key * field value ...`（`*` = 服务端生成 Entry ID） |
| 直接读（无组） | `XREAD`、`XRANGE`（按 ID/时间范围回读） |
| 裁剪保留 | `XTRIM key MAXLEN ~ N` / `MINID ~ <id>`；也可在 `XADD` 时带裁剪参数 |
| 组建/删 | `XGROUP CREATE/DESTROY`；`XGROUP SETID` 重置位点 |
| 组内消费 | `XREADGROUP GROUP <group> <consumer> COUNT n BLOCK ms STREAMS key >`（`>` = 只取新条目） |
| 确认 | `XACK key group id...` |
| 查未确认 | `XPENDING key group`（摘要）/ `XPENDING key group - + N`（明细） |
| 接管未确认 | `XCLAIM`（指定条目）/ `XAUTOCLAIM`（按空闲时长批量，返回新游标） |
| 观察 | `XINFO STREAM/GROUPS/CONSUMERS`、`XLEN` |

## 十二维度逐一回答

1. **定位**：Redis 数据结构之上的追加日志 + 消费组；首先是「轻量持久日志与任务队列」。
2. **核心实体**：见上表；注意 Consumer 名字只是字符串，不校验进程身份。
3. **路由**：无内容路由；Stream key 即目的地，广播靠多组，详见 [路由与分发](/brokers/redis-streams/routing)。
4. **存储与保留**：条目写入即存（内存，AOF/RDB 决定是否落盘）；保留由 `XTRIM`/`MAXLEN` 控制，ACK 不删除；可按 Entry ID 任意回放。
5. **生产可靠性**：`XADD` 是同步命令，返回 Entry ID 即单节点写入成功；多副本要更强保证需 `WAIT`。无内置幂等生产；可用显式 Entry ID 去重（ID 已存在则拒绝/覆盖语义见官方文档）。
6. **消费可靠性**：`XREADGROUP` 投递即进 PEL；`XACK` 才移出；崩溃后条目留在 PEL 等 `XCLAIM/XAUTOCLAIM`。
7. **投递语义**：NOACK 读取 = at-most-once；正常 ACK 流程 = at-least-once；不存在服务端 exactly-once（业务需幂等，见 [可靠性](/brokers/redis-streams/reliability)）。
8. **顺序**：单 Stream 全局 FIFO（Entry ID 有序）；组内分发给多个消费者时，「处理完成顺序」不再等于写入顺序。
9. **失败处理**：无内置重试与 DLQ；用 PEL + 空闲时长 + XCLAIM 自建有限重试，超限条目移入独立「DLQ Stream」是常见模式。
10. **高可用与扩展**：主从复制是异步的，故障切换可能丢未复制条目；Cluster 按 key 分槽但**不拆分单个 Stream**，见 [存储与高可用](/brokers/redis-streams/storage-ha)。
11. **安全与可观测**：ACL 按命令/key 模式授权；`INFO`、`XINFO`、`XPENDING` 提供核心指标，见 [运维与观测](/brokers/redis-streams/operations)。
12. **限制与反模式**：见 [陷阱与检查表](/brokers/redis-streams/pitfalls)。

## 不可直接等价之处

- **Consumer Group ≠ Kafka Consumer Group**：Redis 的组是 Stream 内的位点+PEL 记录，无再均衡协议、无分区分配；组内分发由服务端逐条指派，而非按分区归属。
- **ACK ≠ 删除**：与 RabbitMQ 的 basicAck（消息出队）不同，`XACK` 只影响该组的 PEL。
- **Entry ID ≠ Kafka Offset**：Entry ID 是全局时间语义的 ID（可跨组比较），offset 是分区内序号。
- **Stream 保留 ≠ PEL**：条目被 `XTRIM` 删除后，引用它的 PEL 记录仍在（消费方看到的是「已删除」标记）——保留策略与确认状态是两套独立状态。
