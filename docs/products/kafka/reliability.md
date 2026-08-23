# Apache Kafka 可靠性

> 本页结论：Kafka 的可靠性由三处配置共同决定——生产端 `acks` + 幂等/事务、Broker 端副本与 ISR、消费端 offset 提交时机。「提交 offset」与「业务提交」是两个独立动作，之间的崩溃窗口靠幂等消费兜底；事务只覆盖 Kafka 内部，不等于外部系统 exactly-once。

## 生产端：acks、重试与幂等

| acks | 确认条件 | 丢失窗口 |
| :--- | :--- | :--- |
| 0 | 不等确认 | 网络/Broker 故障即丢 |
| 1 | Leader 写入内存/页缓存 | Leader 崩溃且未同步到 Follower → 丢 |
| all（-1） | ISR 全部副本写入 | 取决于 ISR 收缩与 `min.insync.replicas` |

配套关系：

- `acks=all` 必须配合副本数 ≥2 才有意义；ISR 只剩 Leader 时 all 退化为 1。`min.insync.replicas` 让 Broker 在 ISR 不足时拒绝写入（宁可不可用，不假确认）。
- **Producer 重试**：网络抖动时客户端自动重发，非幂等配置下可能产生重复记录（同内容两个 offset）。
- **Idempotent Producer**（`enable.idempotence=true`，本仓库默认）：为每条记录带 producer id + 序列号，Broker 去重，重试不再产生重复。它是事务的前置条件。

```java
props.put("acks", "all");
props.put("enable.idempotence", "true");
RecordMetadata md = producer.send(record).get(); // partition + offset
```

## 消费端：offset 提交即「确认」

Kafka 没有单条 ACK；消费进度就是已提交 offset。

| 模式 | 行为 | 风险 |
| :--- | :--- | :--- |
| 自动提交（enable.auto.commit=true） | 按时间间隔提交「已 poll 到」的位点 | 处理中崩溃 → 已提交但未处理完 = 丢；提交后重新 poll 前崩溃边界附近 = 重复 |
| 手动提交（commitSync/commitAsync） | 业务决定提交时机 | 提交早于业务完成同样有丢窗口 |

## 崩溃窗口与幂等消费（§5.4 基准实现）

正确顺序：**业务事务提交 → commitSync**。

```text
1. 开启本地数据库事务
2. 插入 messageId 到 processed_messages（唯一键）
3. 唯一键冲突 → duplicate_skipped
4. 首次处理 → 执行业务写入，提交事务
5. 提交成功后才 commitSync（含该分区新位点）
```

第 4 步成功、第 5 步前崩溃 → 重启后从旧 offset 重读 → 幂等表拦截。该窗口不可消除。**「提交 offset 等于业务数据库已成功提交」是错误表述**——两者是独立系统上的两个动作。本仓库 kafka basic 实验即按此实现：

<LabOutput product="kafka" lab="basic" />

## 事务的边界

Transactional Producer 把一个事务内的多条 produce（可加 sendOffsetsToTransaction 把消费位点一起原子提交）变成原子可见：

- `read_committed` 消费者只能看到已 `commitTransaction` 的消息；`abortTransaction` 的消息永不可见。
- 幂等 producer 保证序列号无重复；事务协调器（transaction coordinator）管理事务状态。

动手验证（3 条 commit 事务可见，2 条 abort 事务不可见）：

```bash
bash demos/kafka/idempotence-transaction/run.sh
```

<LabOutput product="kafka" lab="idempotence-transaction" />

边界必须说清楚（禁止表述之三）：

- Kafka EOS 的 exactly-once 指 **Kafka 内部**（topic → topic 的 produce-consume）不重不丢；
- **开启事务后，任意外部系统副作用（数据库、HTTP、短信）都不是 exactly-once**——外部写入仍需幂等设计。

## 顺序与重试的关系

- 分区内顺序由写入顺序决定；Producer 开 `max.in.flight.requests.per.connection>1` 且非幂等时，重试可能乱序。幂等 producer 允许最多 5 个在途请求仍保序。
- 消费端「失败重试」通常意味着跳过或转发该消息（应用层 DLQ），没有 RabbitMQ 式 requeue 到队头。

## 三层语义总结

| 层级 | 保证 | 条件 |
| :--- | :--- | :--- |
| Broker | 确认的消息在 ISR 全部副本可读 | acks=all + min.insync.replicas≥2（多副本）；本仓库单节点 RF=1 仅覆盖 Leader 存活场景 |
| Client | 不重发丢、不提前提交 | 幂等 producer + 异常重试；手动 commitSync 且晚于业务提交 |
| Business | 效果恰好一次 | 幂等表 + 本地事务；外部系统副作用不在 Kafka 事务覆盖内 |

## 常见误区

- 「acks=all 就绝对不丢」——ISR 收缩到 1 时确认不再要求第二个副本；必须与 min.insync.replicas 一起配置。
- 「事务提交后所有下游都恰好一次」——见上文边界说明。
- 「消费者崩溃只重投一条」——重投单位是「已提交 offset 之后的全部消息」。

## 官方资料

- Delivery Semantics：<https://kafka.apache.org/documentation/#semantics>（checkedAt: 2026-08-19）
- Producer Configs（acks/enable.idempotence）：<https://kafka.apache.org/documentation/#producerconfigs>（checkedAt: 2026-08-19）
- Transactions：<https://kafka.apache.org/documentation/#transactions>（checkedAt: 2026-08-19）
