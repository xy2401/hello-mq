# Apache Pulsar 可靠性

> 本页结论：Pulsar 的可靠性由三段决定——生产端 `send()` 确认依赖 BookKeeper 的 ack quorum 持久化，消费端 ack 时机决定丢失/重复窗口，重投与 DeadLetterPolicy 接管失败路径。「ack」与「业务提交」是两个独立动作，之间的崩溃窗口靠幂等消费兜底。

## 生产端：确认、重试与去重

| 发送方式 | 确认含义 | 风险 |
| :--- | :--- | :--- |
| 同步 `send()` | 返回 MessageId = 消息已按 ack quorum 写入 bookie | 阻塞等待吞吐低，但语义最清晰 |
| 异步 `sendAsync()` | 回调/Future 返回结果 | **不处理失败回调 = 静默丢消息** |
| 批量（batching） | 一批共享确认；刷盘时机由 batch 配置与 `flush` 决定 | 批内一条失败的处理要看客户端实现与重试配置 |

配套关系：

- **Producer 重试**：网络抖动时客户端重发，同一消息可能写入两次（不同 MessageId）——at-least-once 在生产端同样成立。
- **Broker 侧消息去重**（message deduplication）默认关闭；开启后按 producer name + sequence id 去重。本仓库不依赖它，统一用幂等消费兜底。

## 消费端：ack 即「确认」

| 机制 | 行为 | 注意 |
| :--- | :--- | :--- |
| Individual ack | 逐条确认，进度跳过空洞 | 本仓库默认：业务提交一条 ack 一条 |
| Cumulative ack | 确认「该 MessageId 及之前全部」 | 批量场景高效，但失败重投会牵连已处理部分 |
| `negativeAcknowledge` | 主动要求立即重投该消息 | 仅 Shared/Key_Shared/Failover 语义下有效；毒消息用它触发重投 |
| ackTimeout | 超时未 ack 自动重投 | 兜底机制；太短会把慢处理误判为失败 |
| 消费者断开 | 未 ack 消息重新分配给其他消费者 | 崩溃重投的直接来源 |

## 崩溃窗口与幂等消费（§5.4 基准实现）

正确顺序：**业务事务提交 → ack**。

```text
1. 开启本地数据库事务
2. 插入 messageId 到 processed_messages（唯一键）
3. 唯一键冲突 → duplicate_skipped，照常 ack
4. 首次处理 → 执行业务写入，提交事务
5. 数据库提交成功后才 acknowledge（individual）
```

第 4 步成功、第 5 步前崩溃 → 消息重投 → 幂等表拦截。**「ack 等于业务数据库已成功提交」不成立**——两者是独立系统上的两个动作，窗口不可消除。崩溃重投的通用分析见 [消费者崩溃实验](/labs/consumer-crash)。basic 实验即按此实现：

<LabOutput product="pulsar" lab="basic" />

## 重投与 DLQ：DeadLetterPolicy

客户端 DeadLetterPolicy 为 Shared/Key_Shared 订阅提供失败出口：

- 每次 `negativeAcknowledge`（或 ackTimeout）计一次重投；重投次数超过 `maxRedeliverCount` 后，消息被转入死信 Topic，命名 `<topic>-<sub>-DLQ`（可选配重试 Topic 先缓冲）。
- 不配置 DeadLetterPolicy 时，失败消息**无限重投**——backlog 不降、日志刷错，是最常见的配置缺失。
- DLQ 是普通 Topic：需要独立的订阅去消费、告警与人工处置。

redelivery-replay 实验（`persistent://public/default/orders-redeliver`，Shared 订阅 + `maxRedeliverCount=2`）验证完整路径：毒消息（aggregateId=order-poison）被 `negativeAcknowledge` 反复重投，达到策略上限后进 DLQ（断言毒消息投递次数与 `dlqMessages=1`，正常消息不受阻塞）；随后用 `pulsar-admin reset-cursor` 把游标重置到 earliest 全量回放，断言再次收到全量消息（对比 [毒消息实验](/labs/poison-message) 的 RabbitMQ 组合式重试）：

```bash
bash demos/pulsar/redelivery-replay/run.sh
```

<LabOutput product="pulsar" lab="redelivery-replay" />

回放的前提是数据仍在：retention/TTL 决定可回放窗口，见 [存储与高可用](/brokers/pulsar/storage-ha)。

## 事务的边界

Pulsar 事务可以把「多 Topic/多分区发布 + 订阅 ack」变成原子操作，实现 Pulsar 内部的 exactly-once 效果。边界必须说清楚：

- 事务覆盖的是 **Pulsar 内部**的发布与 ack 原子性；
- 任何外部系统副作用（数据库、HTTP、短信）都不在事务范围内，仍需幂等设计；
- 本仓库实验不覆盖事务（基准实现是「手动 ack + 幂等表」）。

## 顺序与重投的关系

- Exclusive/Failover：未 ack 消息会阻塞 cursor，重投按原顺序来——保序的代价是毒消息卡线，必须配 DLQ 出口。
- Shared：重投消息可能乱序回到不同消费者——任务语义必须容忍乱序。
- Key_Shared：同 key 仍粘连同一消费者，但该消费者未 ack 的同 key 消息会阻塞后续同 key 消息。

## 三层语义总结

| 层级 | 保证 | 条件 |
| :--- | :--- | :--- |
| Broker/存储层 | 确认的消息在 ack quorum 的 bookie 上可读 | 同步发送；本仓库 standalone 单 bookie 仅覆盖单节点存活场景 |
| Client 层 | 不静默丢、不提前 ack | 处理发送失败回调；individual ack 晚于业务提交；negativeAck 表达失败 |
| Business 层 | 效果恰好一次 | 幂等表 + 本地事务；外部系统副作用不在 Pulsar 事务覆盖内 |

## 常见误区

- 「ack 了就等于落库了」——见崩溃窗口说明，顺序只能是业务提交在前。
- 「消费失败会自动进 DLQ」——不会；DeadLetterPolicy 是客户端显式配置。
- 「cumulative ack 永远更优」——失败重投会牵连整段，重试风暴放大重复处理。

## 官方资料

- Ack / Redelivery / DLQ：<https://pulsar.apache.org/docs/next/concepts-messaging>（checkedAt: 2026-08-19）
- Java Client：<https://pulsar.apache.org/docs/client-libraries/java>（checkedAt: 2026-08-19）
- Transactions：<https://pulsar.apache.org/docs/next/txn-how>（checkedAt: 2026-08-19）
