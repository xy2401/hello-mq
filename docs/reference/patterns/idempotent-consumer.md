# 幂等消费

> 本页结论：at-least-once 投递下重复不是意外而是常态，业务必须预期重复。幂等消费的标准做法是：`processed_messages` 唯一键与业务写入放在同一个本地事务里，事务提交之后才 ACK/提交 offset。「业务已提交、确认未发出」的崩溃窗口无法消除，只能靠幂等表兜住。

## 为什么重复不可避免

四个产品的确认机制不同（RabbitMQ ACK、Kafka offset 提交、RocketMQ 消费位点、Pulsar ack），但失败窗口的位置相同：**业务副作用已生效，向 Broker 的确认还没发出**。此时 Broker 认为消息未确认，必然重投。反过来若先确认再写业务，窗口就变成丢消息。顺序只能二选一，本仓库的选择是：**业务事务提交 → 确认**，重复交给幂等表处理（完整推导见[投递语义](/#mq-delivery-semantics)）。

## §5.4 基准实现（所有产品通用）

```text
1. 开启本地数据库事务
2. 尝试将 messageId 插入 processed_messages（唯一键）
3. 唯一键冲突 → 记录 duplicate_skipped，安全确认消息
4. 首次处理 → 执行业务写入，提交本地事务
5. 数据库提交成功后才 ACK / commitSync / 提交消费位点
```

两个细节决定正确性：

- **第 2 步与第 4 步必须同事务**。如果幂等键先单独提交、业务写入后失败，重投到来时会被误判为「已处理」而跳过——业务永远不会执行。
- **第 5 步永远在最后**。确认是「业务已持久化」的通知，不是业务本身的一部分。

## 崩溃窗口：已验证的实验证据

本仓库用崩溃注入复现了这个窗口（第 2 步成功、第 5 步前 `Runtime.halt(137)`，重启后消息带 `redelivered=true` 到达，被幂等表拦截为 `duplicate_skipped`，业务表恰好 3 行）：

<LabOutput product="rabbitmq" lab="consumer-crash" />

完整实验步骤与断言解读见 [RabbitMQ 可靠性](/products/rabbitmq/reliability)。Kafka 分卷从 offset 语义给出同样的结论（见 [Kafka 可靠性](/products/kafka/reliability)「崩溃窗口与幂等消费」）：**「提交 offset 等于业务已成功」是禁止表述**——那是两个系统上的两个独立动作。

## 去重键怎么选

| 选择 | 适用 | 注意 |
| :--- | :--- | :--- |
| `messageId`（默认） | 通用；信封必填，天然全局唯一 | 生产者重发若生成新 messageId，去重失效——[Outbox](/reference/patterns/outbox) 要求 messageId 在写发件箱时就固定 |
| 业务键（如 `orderId` + 操作类型） | 生产者可能用不同 messageId 重发同一业务动作 | 键要能代表「同一个业务意图」，不是「同一条消息」 |
| 天然幂等的业务写法 | 状态机式写入（`UPDATE … SET status='PAID' WHERE status='UNPAID'`） | 幂等表仍然建议保留，用于观测与防回归 |

其他工程点：

- 幂等记录要有**保留策略**（按业务窗口保留，如 7～30 天后归档），否则表无限增长；归档窗口外的极老重投按新消息处理，业务键约束兜底。
- 用 Redis `SETNX` 做去重时，注意它与业务写入**不在同一事务**：标记成功、业务失败后 Redis 键还在，重投会被错误跳过。分布式锁/缓存只适合做前置快筛，最终裁决要落在与业务同库的唯一键上。
- 不要根据 `redelivered=true` 直接跳过：重投的消息可能第一次就没处理完，必须走完整幂等流程（见 [RabbitMQ 可靠性](/products/rabbitmq/reliability)）。

## 与重试的关系

重试会放大重复：同一条消息每次重试都可能在「业务已提交、未确认」处失败。因此[重试与 DLQ](/reference/patterns/retry-and-dlq)的消费逻辑必须复用同一套幂等流程，而不是在重试路径上绕过它。观测上，`duplicatesObserved`/重复拦截数应与重投率一起看（见[可观测性](/reference/operations/observability)统一指标）。

## 保证成立的条件 / 不保证什么

- 条件：messageId 全局唯一且生产者不随意更换；幂等表与业务同库同事务；确认动作在事务之后。
- 不保证：业务副作用「恰好一次」中外部系统部分——调用短信、第三方 HTTP 这类无法回读校验的副作用，需要在调用前先落幂等标记并容忍「可能已发出」。
- 不消除崩溃窗口本身，只是让窗口的后果从「重复落库」变成「一次 duplicate_skipped 日志」。

## 常见误区

- 「重复是小概率，可以不管」——at-least-once 的含义是业务**必须预期重复**，不是「偶尔可能重复」。
- 「先 ACK 再写库更安全」——方向反了，那会把重复窗口换成丢失窗口。
- 「幂等表只是性能优化」——它是崩溃窗口下的正确性组件，不可省略。
- 「Kafka 开了事务/EOS 就不用幂等了」——EOS 只覆盖 Kafka 内部 topic→topic，外部数据库副作用仍需幂等（见 [Kafka 可靠性](/products/kafka/reliability)）。

## 官方资料

- RabbitMQ Acknowledgements & Redelivery：<https://www.rabbitmq.com/docs/confirms>（checkedAt: 2026-08-19）
- Kafka Delivery Semantics：<https://kafka.apache.org/documentation/#semantics>（checkedAt: 2026-08-19）
- 模式参考（非产品官方文档）：Idempotent Consumer，microservices.io：<https://microservices.io/patterns/data/idempotent-consumer.html>（checkedAt: 2026-08-19）
