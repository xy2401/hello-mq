# 重试与 DLQ 矩阵

> 本页结论：只有 RocketMQ 提供 Broker 内置的消费重试与 DLQ（retryMaxTimes + %DLQ%）；Pulsar 以原生重投机制 + 客户端 DeadLetterPolicy 组合实现；RabbitMQ 靠 TTL+DLX 组合模式；Kafka 完全依赖应用层 Retry Topic 或框架，Broker 没有内置消费重试。

覆盖 spec §8.2「重试/延迟/DLQ 矩阵」的重试与 DLQ 部分（延迟消息见[延迟/定时消息](/matrix/delayed-messages)）。版本基线与标记规则见[矩阵总览](/matrix/)（checkedAt: 2026-08-19）。

## 重试与 DLQ 能力

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar |
| :--- | :--- | :--- | :--- | :--- |
| 消费重试机制 | 🔧 无内置重试：标准模式是 nack → DLX → 重试队列（TTL 延迟）→ 重新绑定回业务队列（[reliability](/brokers/rabbitmq/reliability)，[实验](/labs/poison-message)） | 🛠 Broker 无内置消费重试：应用自行把失败消息写入 Retry Topic 再消费；🧩 Spring Kafka 等框架可生成 retry topic/DLT（[reliability](/brokers/kafka/reliability)） | ✅ Broker 内置：消费组失败消息自动进入 %RETRY% 重试队列重投，次数与间隔可配（retryMaxTimes，并发消费默认 16 次、间隔递增）（[reliability](/brokers/rocketmq/reliability)） | 🔧 重投机制原生（negativeAck / ack 超时后 Broker 重投），但「有限次数 + 进 DLQ」需消费者启用 DeadLetterPolicy 组合实现（[reliability](/brokers/pulsar/reliability)） |
| 退避策略 | 🔧 靠多级 TTL 递增的重试队列模拟退避，间隔取决于队列 TTL 配置（[reliability](/brokers/rabbitmq/reliability)） | 🛠 应用自定：多档 Retry Topic（retry-1/retry-2/…）或进程内退避（会占住分区）（[patterns](/patterns/retry-and-dlq)） | ✅ 内置递增退避间隔（1s、5s、10s、30s、1m…逐级拉长），无需自建（[reliability](/brokers/rocketmq/reliability)） | 🔧 ack 超时时间可配，但多级退避需配合 Retry Letter Topic / 自建多档策略（[reliability](/brokers/pulsar/reliability)） |
| DLQ（死信隔离） | 🔧 Dead Letter Exchange + 专用死信队列：nack(requeue=false) 或 TTL 过期的消息转入（[routing](/brokers/rabbitmq/routing)） | 🛠 DLQ 只是应用约定的普通 Topic（DLT），Broker 不感知死信语义（[reliability](/brokers/kafka/reliability)） | ✅ 重试耗尽自动转入 `%DLQ%<consumerGroup>`，按消费组隔离，可人工重投（[reliability](/brokers/rocketmq/reliability)） | 🔧 DeadLetterPolicy 达最大重投次数后写入死信 Topic（deadLetterTopic），需消费端显式开启（[reliability](/brokers/pulsar/reliability)） |
| 对顺序的影响 | 🔧 重试消息重新入队必然乱序，需顺序时只能串行阻塞或旁路处理（[reliability](/brokers/rabbitmq/reliability)） | ✅ 原分区位点不受影响：重试发生在旁路 Topic，原日志顺序不变（[reliability](/brokers/kafka/reliability)） | 🔧 普通消息：失败进重试队列不阻塞原队列（乱序）；FIFO 消息：失败挂起顺序组保序但可能阻塞（[reliability](/brokers/rocketmq/reliability)） | 🔧 Shared 重投可能换消费者导致乱序；Key_Shared 同 key 保持绑定；开启 DLQ 后失败消息移出可解除阻塞（[reliability](/brokers/pulsar/reliability)） |
| 毒消息隔离 | 🔧 TTL+DLX 组合 + 死信队列人工巡检（[实验](/labs/poison-message)） | 🛠 应用识别后主动写入 DLT，否则毒消息随位点回退反复出现（[patterns](/patterns/retry-and-dlq)） | ✅ 重试耗尽自动进 %DLQ%，毒消息自动隔离，不阻塞并发消费（[reliability](/brokers/rocketmq/reliability)） | 🔧 DeadLetterPolicy 自动隔离；未开启时毒消息会无限重投（[pitfalls](/brokers/pulsar/pitfalls)） |

> 重试不是限流手段：RocketMQ 文档明确禁止把重试机制当作日常流控使用；RabbitMQ/Kafka 用「重试风暴」做背压同样会把失败放大。有限次数 + 指数退避 + 抖动 + DLQ 隔离是通用设计，见[重试与 DLQ 模式](/patterns/retry-and-dlq)。

## 重试链路对比（同一条失败消息的命运）

| 步骤 | RabbitMQ | Kafka | RocketMQ | Pulsar |
| :--- | :--- | :--- | :--- | :--- |
| 第 1 次失败 | nack → DLX → retry 队列（TTL 等待） | 应用捕获异常，决定写 retry topic 或重新拉取 | Broker 自动投入 %RETRY%，第 1 档间隔后重投 | 应用 negativeAck 或等 ack 超时，Broker 重投 |
| 第 N 次失败 | 在多级 TTL 队列间流转（自建档位） | 在应用自建的多档 retry topic 间流转 | Broker 自动按递增间隔重投直至 retryMaxTimes | 重投次数累计，达到 maxRedeliverCount |
| 最终失败 | 停留在死信队列，人工处理 | 写入 DLT，人工处理 | 自动进 `%DLQ%<group>`，人工处理 | 写入 deadLetterTopic，人工处理 |

## 脚注：同名异义

- **「重试」**：RocketMQ 指 Broker 内置的自动重投（有重试队列、次数、退避）；RabbitMQ/Kafka 语境里的「重试」其实是用户自建模式（TTL+DLX 循环 / Retry Topic），Broker 本身不知道某条消息是第几次尝试；Pulsar 的重投由 negativeAck/ack 超时触发，计数与 DLQ 策略在客户端配置。
- **「DLQ / DLT / %DLQ% / 死信队列」**：RabbitMQ 死信队列是绑到 DLX 的普通队列；Kafka 的 DLT 是应用命名的普通 Topic，Broker 无死信语义；RocketMQ 的 `%DLQ%<consumerGroup>` 由 Broker 按消费组自动创建管理；Pulsar 的 dead letter topic 由 DeadLetterPolicy 派生。四者的管理方式、可见性与重投工具都不同。
- **「消费失败」**：RabbitMQ 是 nack/reject；Kafka 没有失败信令，只有「不提交位点」；RocketMQ 是消费回调返回失败状态；Pulsar 是 negativeAck 或不 ack 等超时。失败信令的有无直接决定了 Broker 能否内置重试。

## 相关页面

- 延迟投递（重试间隔的另一种实现原料）：[延迟/定时消息](/matrix/delayed-messages)
- 基础概念与模式：[重试与 DLQ 模式](/patterns/retry-and-dlq)、[背压与积压](/fundamentals/backpressure)
- 动手实验：[毒消息、重试与 DLQ](/labs/poison-message)
