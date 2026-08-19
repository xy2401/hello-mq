# 可靠消息模式

> 本页结论：可靠消息不是一项单点技术，而是一组可组合的模式——发送侧保证「业务成功必发出」（Outbox），投递侧承认「至少一次」，消费侧用幂等把重复收敛为一次，失败路径用重试与 DLQ 兜底，跨服务一致性用 Saga 表达最终一致。

## 模式地图

| 模式 | 解决什么问题 | 前置依赖 |
| :--- | :--- | :--- |
| [工作队列](/patterns/work-queue) | 任务在消费者组内竞争分发，扩容不加队列 | 手动确认 + 幂等 |
| [发布-订阅](/patterns/pub-sub) | 一个事件复制到每个独立订阅，进度互不影响 | 各订阅各自幂等 |
| [请求-应答](/patterns/request-reply) | 在异步系统上模拟同步调用 | correlationId + 超时 + 幂等 |
| [Outbox](/patterns/outbox) | 业务提交与消息发送的原子性 | 本地事务 + Relay |
| [幂等消费](/patterns/idempotent-consumer) | 把「至少一次」的重复收敛为一次业务效果 | messageId 唯一键 |
| [重试与 DLQ](/patterns/retry-and-dlq) | 失败消息的有限重试与隔离 | 幂等 + 告警 |
| [Saga](/patterns/saga) | 跨服务长事务的最终一致 | Outbox + 幂等 + 重试 |
| [Schema 演进](/patterns/schema-evolution) | 消息契约随时间演进不破坏旧消费者 | 版本化契约 + 兼容性规则 |

## 阅读顺序建议

1. 先读 [幂等消费](/patterns/idempotent-consumer)：它是所有其他模式的地基，本仓库用 consumer-crash 实验快照验证过。
2. 再读 [Outbox](/patterns/outbox) 与 [重试与 DLQ](/patterns/retry-and-dlq)：分别覆盖发送侧与失败路径。
3. 然后按业务需要挑读工作队列 / 发布-订阅 / 请求-应答。
4. 最后读 [Saga](/patterns/saga) 与 [Schema 演进](/patterns/schema-evolution)：前者组合前面所有模式，后者保证系统长期可演进。

## 与各产品能力的关系

模式是产品无关的设计；各产品对模式的原生支持程度不同（例如重试与 DLQ 在 RocketMQ 是 Broker 内置、在 Kafka 是应用层实现），对照见 [横向矩阵](/matrix/) 与 [重试与 DLQ 模式页](/patterns/retry-and-dlq)。
