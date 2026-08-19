# Apache RocketMQ 陷阱与检查表

> 本页结论：汇总 RocketMQ 的默认值陷阱与错误类比，逐条反驳规格 §7.3 的三条禁止表述，并给出一份可逐项打钩的生产上线检查表。

## 默认值陷阱

| 默认/常见配置 | 陷阱 | 正确做法 |
| :--- | :--- | :--- |
| `autoCreateTopicEnable=true` | 拼错 Topic 名静默建出空 Topic，且类型不受控 | 关闭，经 `updateTopic` 显式建并声明 `message.type`（本仓库默认） |
| `autoCreateSubscriptionGroup=true` | 消费组随手生成，重试策略无治理 | 关闭，`updateSubGroup` 显式建并设重试策略 |
| 异步刷盘 + 异步复制当「不丢」 | Broker 崩溃丢未复制/未刷盘消息 | 可靠场景同步刷盘/同步复制，理解延迟代价 |
| 消费端先 ack 再处理 | 崩溃丢消息 | 业务事务提交后才 ack / 才返回 SUCCESS |
| FIFO 队列塞慢/会失败的业务 | 一条失败阻塞整条队列 | 失败消息尽快进重试/DLQ；保序范围最小化 |
| 重试次数不设上限 | 毒消息无限重投、堆积重试队列 | 设 `retryMaxTimes`，耗尽进 `%DLQ%` 并告警 |
| Topic 名用点号 | 5.x 客户端校验 `^[%|a-zA-Z0-9_-]+$` 直接拒绝 | 用 `-`/`_`（本仓库 `orders-basic` 等） |

## 错误类比与禁止表述（规格 §7.3）

以下表述在本仓库视为错误，逐条给出真相：

1. **「事务消息就是分布式强一致事务 / 跨系统原子提交」**
   真相：Half Message 只保证「**本地事务结果**与**消息投递**一致」——要么本地事务成功且消息最终投出，要么都不发生。**下游消费者的处理、外部数据库/HTTP 副作用完全不在其覆盖范围内**，下游仍需可靠消费 + 幂等。它是最终一致的工具，不是强一致事务（见 [可靠性](/brokers/rocketmq/reliability)）。

2. **「发送 SDK 最终失败代表 Broker 一定没有收到」**
   真相：网络超时、客户端重试之下，消息**可能已经写入 Broker**；发送失败只代表你没拿到确认。**必须用幂等键（messageId/业务唯一键）在消费端去重**，不能依赖「发送失败即不存在」的假设。

3. **「消费重试机制可以用作日常限流/背压手段」**
   真相：重试是**失败恢复**机制，把失败消息延后重投；它不是流量控制。用它限流会把正常消息拖进重试队列、放大堆积与延迟。背压应通过控制生产速率、调节消费并发/扩容消费者实现（见 [背压与积压](/fundamentals/backpressure)）。

其他常见错误类比：

- 「RocketMQ 的 MessageQueue = Kafka 的 Partition = RabbitMQ 的 Queue」——三者消费模型不同：MessageQueue/Partition 是日志（消费不删除），RabbitMQ Queue 是 ACK 即删；不可互译。
- 「Topic 建好就能发任意类型消息」——Topic 有消息类型约束（NORMAL/FIFO/TRANSACTION），类型不匹配会被拒。

## 反模式清单

- 用 FIFO 队列承载会频繁失败的逻辑：一条毒消息阻塞同队列全部后续。→ 能乱序的走 Normal Topic，必须保序的把失败快速导向重试/DLQ。
- 一个 Topic 塞所有事件类型还要求顺序：慢事件阻塞整条队列。→ 按事件类型拆 Topic 或用 Tag 分流。
- 把事务消息当「下游一定会成功」：下游副作用不在事务内。→ 下游可靠消费 + 幂等。
- 依赖发送失败判断「没发出去」：可能已写入。→ 幂等键去重。
- 拿单容器实验吞吐当生产基准：本仓库数字仅用于行为验证。

## 生产上线检查表

- [ ] 生产端：同步发送处理回执；发送重试配幂等键，消费端以 messageId 唯一键去重。
- [ ] 消费端：业务事务提交后才 ack（SimpleConsumer）/ 才返回 SUCCESS（PushConsumer）。
- [ ] 幂等：`messageId` 唯一键表与业务写入同事务；重投场景已演练（[basic 实验](/brokers/rocketmq/quick-start) 可复用为验收用例）。
- [ ] 失败路径：`retryMaxTimes` 有上限 + `%DLQ%` + 告警；毒消息有处理预案（[retry-dlq 实验](/brokers/rocketmq/reliability)）。
- [ ] Topic 治理：关闭自动创建；消息类型、队列数、Key/Tag 设计有明确记录。
- [ ] 顺序：保序范围最小化（MessageGroup 粒度）；理解 FIFO 失败阻塞代价。
- [ ] 事务：生产者实现回查 Checker；理解只覆盖本地事务与投递一致。
- [ ] 高可用：可靠场景同步刷盘/复制或 DLedger/Controller；副本数与磁盘有规划。
- [ ] 安全：ACL + TLS、按 Topic/Group 最小授权；管理端口与数据端口分离不暴露公网。
- [ ] 观测：Consume Diff、重试/DLQ 深度、端到端延迟有看板；traceId 贯穿两端日志。
- [ ] 版本：镜像与客户端版本锁定（参考 `.env.versions` 的 tag+digest 双锁）。

## 官方资料

- RocketMQ 文档首页：<https://rocketmq.apache.org/docs/>（checkedAt: 2026-08-19）
- 特性行为（Topic）：<https://rocketmq.apache.org/docs/featureBehavior/01topic>（checkedAt: 2026-08-19）
