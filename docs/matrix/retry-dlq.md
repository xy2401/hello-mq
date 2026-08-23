# 重试与 DLQ 矩阵

> 本页结论：RocketMQ 与 Artemis 提供 Broker 内置的消费重试与 DLQ（RocketMQ：retryMaxTimes + %DLQ%；Artemis：address-setting max-delivery-attempts + dead-letter-address）；Pulsar 以原生重投机制 + 客户端 DeadLetterPolicy 组合实现；NATS JetStream 有原生重投（AckWait/MaxDeliver）但无 DLQ；RabbitMQ 靠 TTL+DLX 组合模式；Redis Streams 靠 PEL + XCLAIM 组合；Kafka 完全依赖应用层 Retry Topic 或框架，Broker 没有内置消费重试。

覆盖 spec §8.2「重试/延迟/DLQ 矩阵」的重试与 DLQ 部分（延迟消息见[延迟/定时消息](/matrix/delayed-messages)）。版本基线与标记规则见[矩阵总览](/matrix/)（checkedAt: 2026-08-19）。

## 重试与 DLQ 能力

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 消费重试机制 | 🔧 无内置重试：标准模式是 nack → DLX → 重试队列（TTL 延迟）→ 重新绑定回业务队列（[reliability](/products/rabbitmq/reliability)，[实验](/matrix/experiment/poison-message)） | 🛠 Broker 无内置消费重试：应用自行把失败消息写入 Retry Topic 再消费；🧩 Spring Kafka 等框架可生成 retry topic/DLT（[reliability](/products/kafka/reliability)） | ✅ Broker 内置：消费组失败消息自动进入 %RETRY% 重试队列重投，次数与间隔可配（retryMaxTimes，并发消费默认 16 次、间隔递增）（[reliability](/products/rocketmq/reliability)） | 🔧 重投机制原生（negativeAck / ack 超时后 Broker 重投），但「有限次数 + 进 DLQ」需消费者启用 DeadLetterPolicy 组合实现（[reliability](/products/pulsar/reliability)） | 🔧 无自动重投：失败消息留在 PEL，由 XCLAIM/XAUTOCLAIM 按空闲时间重领（minIdleTime/次数阈值自定）（[reliability](/products/redis-streams/reliability)） | ✅ JetStream 原生重投：AckWait 超时或 NAK 后自动重投，MaxDeliver 限制次数（[reliability](/products/nats/reliability)） | ✅ Broker 内置：未确认消息按 address-setting 自动重投（max-delivery-attempts 限次、redelivery-delay 定间隔）（[reliability](/products/artemis/reliability)） |
| 退避策略 | 🔧 靠多级 TTL 递增的重试队列模拟退避，间隔取决于队列 TTL 配置（[reliability](/products/rabbitmq/reliability)） | 🛠 应用自定：多档 Retry Topic（retry-1/retry-2/…）或进程内退避（会占住分区）（[patterns](/patterns/retry-and-dlq)） | ✅ 内置递增退避间隔（1s、5s、10s、30s、1m…逐级拉长），无需自建（[reliability](/products/rocketmq/reliability)） | 🔧 ack 超时时间可配，但多级退避需配合 Retry Letter Topic / 自建多档策略（[reliability](/products/pulsar/reliability)） | 🔧 无退避：重领间隔 = 巡检 XAUTOCLAIM 的调度频率，需自建多级策略（[reliability](/products/redis-streams/reliability)） | 🔧 AckWait 为固定间隔重投，无内置递增退避（[reliability](/products/nats/reliability)） | ✅ redelivery-delay + redelivery-multiplier + max-redelivery-delay 组成可配递增退避（[reliability](/products/artemis/reliability)） |
| DLQ（死信隔离） | 🔧 Dead Letter Exchange + 专用死信队列：nack(requeue=false) 或 TTL 过期的消息转入（[routing](/products/rabbitmq/routing)） | 🛠 DLQ 只是应用约定的普通 Topic（DLT），Broker 不感知死信语义（[reliability](/products/kafka/reliability)） | ✅ 重试耗尽自动转入 `%DLQ%<consumerGroup>`，按消费组隔离，可人工重投（[reliability](/products/rocketmq/reliability)） | 🔧 DeadLetterPolicy 达最大重投次数后写入死信 Topic（deadLetterTopic），需消费端显式开启（[reliability](/products/pulsar/reliability)） | 🛠 无死信概念：业务把超过重领次数的消息 XADD 到死信 Stream 再 XACK/XDEL（[reliability](/products/redis-streams/reliability)） | 🛠 无死信队列：MaxDeliver 耗尽后消息被放弃（仍在 Stream 内，可人工重放），隔离需业务转写其他 Subject（[reliability](/products/nats/reliability)） | ✅ 重试耗尽自动转入 address-setting 指定的 dead-letter-address（需预先配置该地址与队列）（[reliability](/products/artemis/reliability)） |
| 对顺序的影响 | 🔧 重试消息重新入队必然乱序，需顺序时只能串行阻塞或旁路处理（[reliability](/products/rabbitmq/reliability)） | ✅ 原分区位点不受影响：重试发生在旁路 Topic，原日志顺序不变（[reliability](/products/kafka/reliability)） | 🔧 普通消息：失败进重试队列不阻塞原队列（乱序）；FIFO 消息：失败挂起顺序组保序但可能阻塞（[reliability](/products/rocketmq/reliability)） | 🔧 Shared 重投可能换消费者导致乱序；Key_Shared 同 key 保持绑定；开启 DLQ 后失败消息移出可解除阻塞（[reliability](/products/pulsar/reliability)） | 🔧 重领后由其他消费者处理必然乱序；不 XACK 会一直占在 PEL（[reliability](/products/redis-streams/reliability)） | 🔧 重投消息晚于后续消息被处理即乱序；日志本身顺序不变（[reliability](/products/nats/reliability)） | 🔧 重投消息延迟后重新入队，可能晚于后续消息（乱序）；Message Group 仍绑定原消费者（[reliability](/products/artemis/reliability)） |
| 毒消息隔离 | 🔧 TTL+DLX 组合 + 死信队列人工巡检（[实验](/matrix/experiment/poison-message)） | 🛠 应用识别后主动写入 DLT，否则毒消息随位点回退反复出现（[patterns](/patterns/retry-and-dlq)） | ✅ 重试耗尽自动进 %DLQ%，毒消息自动隔离，不阻塞并发消费（[reliability](/products/rocketmq/reliability)） | 🔧 DeadLetterPolicy 自动隔离；未开启时毒消息会无限重投（[pitfalls](/products/pulsar/pitfalls)） | 🛠 需业务巡检 PEL 的 delivered-times 并主动隔离；否则反复被 claim（[pitfalls](/products/redis-streams/pitfalls)） | 🔧 MaxDeliver 兜底防止无限重投，但放弃≠隔离，需配合业务记录（[pitfalls](/products/nats/pitfalls)） | ✅ max-delivery-attempts 耗尽自动进死信地址隔离；未配 dead-letter-address 时会无限重投（[reliability](/products/artemis/reliability)） |

> 重试不是限流手段：RocketMQ 文档明确禁止把重试机制当作日常流控使用；RabbitMQ/Kafka 用「重试风暴」做背压同样会把失败放大。有限次数 + 指数退避 + 抖动 + DLQ 隔离是通用设计，见[重试与 DLQ 模式](/patterns/retry-and-dlq)。

## 重试链路对比（同一条失败消息的命运）

| 步骤 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 第 1 次失败 | nack → DLX → retry 队列（TTL 等待） | 应用捕获异常，决定写 retry topic 或重新拉取 | Broker 自动投入 %RETRY%，第 1 档间隔后重投 | 应用 negativeAck 或等 ack 超时，Broker 重投 | 消息留在 PEL；巡检者 XAUTOCLAIM 重领给空闲消费者 | AckWait 超时或 NAK，Broker 自动重投 | 未 ack（连接断开/recover/rollback），Broker 按 redelivery-delay 延迟后重投 |
| 第 N 次失败 | 在多级 TTL 队列间流转（自建档位） | 在应用自建的多档 retry topic 间流转 | Broker 自动按递增间隔重投直至 retryMaxTimes | 重投次数累计，达到 maxRedeliverCount | PEL 中 delivery count 递增，按自建阈值继续重领或隔离 | 重投计数累计，达到 MaxDeliver | delivery count 递增，按 multiplier 递增延迟重投直至 max-delivery-attempts |
| 最终失败 | 停留在死信队列，人工处理 | 写入 DLT，人工处理 | 自动进 `%DLQ%<group>`，人工处理 | 写入 deadLetterTopic，人工处理 | 业务转写死信 Stream 后 XACK/XDEL，人工处理 | 消息被放弃（仍留日志中），需人工发现并处理 | 自动转入 dead-letter-address，人工处理 |

## 脚注：同名异义

- **「重试」**：RocketMQ 指 Broker 内置的自动重投（有重试队列、次数、退避）；Artemis 同样是 Broker 内置（address-setting 控制次数与退避，delivery count 由 Broker 维护）；RabbitMQ/Kafka 语境里的「重试」其实是用户自建模式（TTL+DLX 循环 / Retry Topic），Broker 本身不知道某条消息是第几次尝试；Pulsar 的重投由 negativeAck/ack 超时触发，计数与 DLQ 策略在客户端配置。
- **「DLQ / DLT / %DLQ% / 死信队列」**：RabbitMQ 死信队列是绑到 DLX 的普通队列；Kafka 的 DLT 是应用命名的普通 Topic，Broker 无死信语义；RocketMQ 的 `%DLQ%<consumerGroup>` 由 Broker 按消费组自动创建管理；Pulsar 的 dead letter topic 由 DeadLetterPolicy 派生；Artemis 的 dead-letter-address 由 address-setting 指定、需预建队列。五者的管理方式、可见性与重投工具都不同。
- **「消费失败」**：RabbitMQ 是 nack/reject；Kafka 没有失败信令，只有「不提交位点」；RocketMQ 是消费回调返回失败状态；Pulsar 是 negativeAck 或不 ack 等超时。失败信令的有无直接决定了 Broker 能否内置重试。

## 相关页面

- 延迟投递（重试间隔的另一种实现原料）：[延迟/定时消息](/matrix/delayed-messages)
- 基础概念与模式：[重试与 DLQ 模式](/patterns/retry-and-dlq)、[背压与积压](/concepts/backpressure)
- 动手实验：[毒消息、重试与 DLQ](/matrix/experiment/poison-message)
