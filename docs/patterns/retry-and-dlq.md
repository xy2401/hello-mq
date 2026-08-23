# 重试与 DLQ

> 本页结论：重试与死信队列（DLQ）在四个产品里是三种不同机制，不可互相类比：RabbitMQ 没有内置消费重试，靠 TTL + DLX 组合出重试环；RocketMQ 由 Broker 内置按档位重试并自动转死信；Kafka 完全没有内置重试，重试与 DLQ 都是应用层用 retry/DLQ topic 搭出来的。DLQ 是隔离区与证据柜，不是垃圾桶——进 DLQ 之后仍需告警、人工定责与回放。

## 为什么需要「有限重试 + 隔离」

消费失败分两类：

- **瞬时故障**（下游超时、锁冲突、网络抖动）：重试大概率成功；
- **确定性失败**（Schema 缺字段、引用数据不存在、代码必错路径，即毒消息）：重试一万次也不会成功。

对毒消息无限重试/`requeue` 会卡住队列头部，阻塞后面所有正常消息。正确形态是：有限次数重试（带延迟），超过上限后把消息移入 DLQ 隔离，保留原始内容供人工处理。本仓库毒消息实验完整复现了这条链路：

<LabOutput product="rabbitmq" lab="retry-dlq" />

实验拓扑与断言细节见[毒消息、重试与 DLQ](/matrix/experiment/poison-message)。

## 三机制对比（RabbitMQ / RocketMQ / Kafka）

| 维度 | RabbitMQ：TTL + DLX 组合 | RocketMQ：Broker 内置 | Kafka：应用层 |
| :--- | :--- | :--- | :--- |
| 机制 | work 队列 nack(requeue=false) → DLX 转入 retry 队列（TTL）→ 到期 dead-letter 回 work | Broker 自动把失败消息投入 `%RETRY%<group>` 主题，按档位延迟后再投递 | 消费者自己捕获异常，发到 retry topic（可多级），超限发 DLQ topic |
| 延迟控制 | retry 队列的 `x-message-ttl`（队列级，到期从队头计算） | Broker 重试档位（递增延迟） | 应用自定义：多级 retry topic + 延迟手段（外部调度/时间轮） |
| 次数记录 | 消息头 `x-death`（Broker 每次 dead-letter 追加）+ 应用计数 | Broker 侧记录重投次数 | 消息头里由应用自行携带 `attempt` |
| DLQ 形成 | 应用判断 attempt ≥ 上限后显式发布到 DLQ 队列并 ACK 原消息 | 超过最大重试次数 Broker 自动转入 `%DLQ%<group>` | 应用显式 produce 到 DLQ topic |
| 对顺序的影响 | dead-letter 会改变消息在队列中的位置，重试环中无严格队头顺序承诺 | 重试消息脱离原消费顺序 | retry/DLQ topic 与原分区无顺序关系 |

三个机制**不是同一功能的不同配置**，写文档与选型时不得互相替换描述。

## 重试预算与退避

- **区分故障类型**：下游超时按瞬时故障重试；Schema 校验失败这类确定性错误应尽早转 DLQ，不要浪费重试预算（毒消息实验里 attempt 1 即可判定）。
- **带延迟的重试**：立即重试往往打在同一个故障点上；指数退避或固定档位能显著降低[重投风暴](/operations/failure-playbook)风险。
- **上限必须显式**：`max-attempts` 是系统参数而不是代码品味；改上限要同步评估 DLQ 增量与告警阈值。
- **重试也要幂等**：每次重试都可能撞上「业务已提交、确认未发出」窗口，重试路径必须复用[幂等消费](/patterns/idempotent-consumer)流程。

## DLQ 治理

DLQ 只完成「隔离」，治理闭环在 DLQ 之外：

1. **告警**：DLQ 深度、新增速率、最老消息年龄都要有阈值告警（指标定义见[可观测性](/operations/observability)）。
2. **留证**：进 DLQ 时同步记录失败原因、attempt 历史、原始 traceId——DLQ 里只有消息本体，原因在日志里。
3. **回放**：修复问题后从 DLQ 重放是常规操作；回放等价于重新投递，接收端幂等仍然必须成立。
4. **保留期**：DLQ 消息应有保留策略，超期归档到冷存储，而不是静默删除。

## 保证成立的条件 / 不保证什么

- 条件：重试次数可观测（x-death / Broker 计数 / 应用头字段）；DLQ 有告警与回放流程；重试路径幂等。
- 不保证：重试后消息仍保持原队列顺序；进入 DLQ 的消息会被自动处理；RabbitMQ 队列级 TTL 能表达任意精细的逐条延迟（到期从队头计算，见[毒消息实验](/matrix/experiment/poison-message)「不保证什么」）。

## 常见误区

- 「nack(requeue=true) 一直重试就行」——无延迟、无计数，毒消息无限占用队头。
- 「四个产品都有内置消费重试」——只有 RocketMQ 是 Broker 内置；RabbitMQ 是队列参数组合，Kafka 完全在应用层。
- 「消息进了 DLQ 就没事了」——DLQ 不处理消息，只是把问题从「阻塞」变成「待办」；没有告警的 DLQ 等于黑洞。
- 「DLQ 里的消息可以直接删」——删除前先确认业务侧确实不需要补偿或审计。

## 官方资料

- RabbitMQ Dead Letter Exchanges：<https://www.rabbitmq.com/docs/dlx>（checkedAt: 2026-08-19）
- RabbitMQ Time-to-Live：<https://www.rabbitmq.com/docs/ttl>（checkedAt: 2026-08-19）
- RocketMQ 消费重试（Consumption Retry）：<https://rocketmq.apache.org/docs/featureBehavior/10consumerretrypolicy/>（checkedAt: 2026-08-19）
- Kafka Delivery Semantics（无内置消费重试的语义背景）：<https://kafka.apache.org/documentation/#semantics>（checkedAt: 2026-08-19）
