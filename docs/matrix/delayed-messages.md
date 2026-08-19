# 延迟/定时消息矩阵

> 本页结论：RocketMQ 与 Artemis 提供原生延迟消息——RocketMQ 的 Delay 类型可指定投递时间戳，Artemis 用 `_AMQ_SCHED_DELAY` 属性指定延迟毫秒数；RabbitMQ 用 TTL+DLX 组合近似（精度受队头过期检查限制）；Kafka、Pulsar、Redis Streams、NATS 均无内置机制，需要业务自建定时层（Redis 常用 ZSET 到期表，NATS 依赖外部调度器）。

覆盖 spec §8.2「重试/延迟/DLQ 矩阵」的延迟部分。版本基线与标记规则见[矩阵总览](/matrix/)（checkedAt: 2026-08-19）。

## 延迟/定时能力

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 延迟消息机制 | 🔧 队列级/消息级 TTL + DLX 组合：消息过期后死信转发到目标队列（[routing](/brokers/rabbitmq/routing)）；另有社区 delayed-message-exchange 插件（🧩，非核心发行版） | 🛠 无内置：常见做法是 delay topic + 定时扫描，或业务侧时间轮/调度器到点重新发送（[pitfalls](/brokers/kafka/pitfalls)） | ✅ 原生 Delay 消息类型：发送时指定投递时间戳（delivery timestamp），Broker 定时调度投递（[concepts](/brokers/rocketmq/concepts)） | 🛠 无内置延迟消息：需外部调度器/定时任务到点发送，或独立延迟 Topic 轮询（[pitfalls](/brokers/pulsar/pitfalls)） | 🛠 无内置：常用 ZSET（score=到期时间）做到期表，轮询 ZRANGEBYSCORE 后 XADD 到目标 Stream（[pitfalls](/brokers/redis-streams/pitfalls)） | 🛠 无内置：需外部调度器到点向 Subject 发布；JetStream 不支持延迟投递配置（[pitfalls](/brokers/nats/pitfalls)） | ✅ 原生：发送时设置 `_AMQ_SCHED_DELAY` 属性（延迟毫秒数），Broker 到期后才投递到目标队列（[concepts](/brokers/artemis/concepts)） |
| 精度与粒度 | 🔧 per-message TTL 只在消息到达队头时才检查过期：队头未过期会阻塞后面已到期的消息，大量不同 TTL 混用时精度差（[pitfalls](/brokers/rabbitmq/pitfalls)） | 🛠 取决于自建扫描频率与时间轮实现，Broker 不参与 | ✅ 秒级精度的定时投递；注意经典版本只支持固定延迟档位（1s/5s/…/2h），5.x 支持任意时间戳（[concepts](/brokers/rocketmq/concepts)） | 🛠 取决于自建调度器实现，Broker 不参与 | 🛠 取决于 ZSET 轮询频率，Broker 不参与调度 | 🛠 取决于自建调度器实现，Broker 不参与 | ✅ 毫秒级延迟属性；延迟消息在 journal 中单独调度，不阻塞队列内其他消息（[concepts](/brokers/artemis/concepts)） |
| 取消/修改已定时消息 | ➖ 无原生取消手段（TTL 消息只能等过期或清空队列） | 🛠 自建方案自定（如标记删除） | 🔧 受实现限制，通常不支持发送后修改投递时间；以官方文档为准 | 🛠 自建方案自定 | 🔧 ZSET 方案天然支持：ZREM 取消、ZADD 改期，是相对优势 | 🛠 自建方案自定 | ➖ 无原生取消手段：消息已写入 journal，只能等到期投递 |
| 与顺序的关系 | 🔧 延迟消息经 DLX 重新入队，不与原队列保持顺序 | 🛠 重新发送后按新写入位置排序 | 🔧 Delay 消息与 FIFO 是不同消息类型，Topic 类型约束不同，混用前需确认 | 🛠 到点重发后按新写入位置排序 | 🛠 到点 XADD 后按新 Entry ID 排序 | 🛠 到点发布后按新 sequence 排序 | 🔧 到期后进入目标队列参与排序，不与先到的非延迟消息保持原顺序 |
| 大量延迟任务的适用性 | 🔧 适合中小规模、档位少的场景；海量不同到期时间会放大队头阻塞问题 | 🛠 海量定时可自建基于日志扫描的方案，但复杂度在业务侧 | ✅ 面向业务定时场景设计（如订单超时关闭、定时提醒）（[concepts](/brokers/rocketmq/concepts)） | 🛠 依赖外部调度系统的容量与可靠性 | 🔧 ZSET 到期表是 Redis 常见做法，适合中小规模；注意内存容量 | 🛠 依赖外部调度系统的容量与可靠性 | ✅ 内置调度适合订单超时关闭等场景；海量延迟消息会占用 journal/内存，需评估容量（[storage-ha](/brokers/artemis/storage-ha)） |

## 各产品延迟链路（「30 分钟后关闭未支付订单」）

| 步骤 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 发送 | 发到 TTL=30min 的延迟队列 | 写入业务自建 delay topic | 发送 Delay 消息，deliveryTimestamp = now+30min | 写入自建延迟 topic 或先落库 | ZADD 到期表（score=now+30min） | 写入自建存储/交给调度器 | 发送时设 `_AMQ_SCHED_DELAY=1800000`（30min） |
| 到期 | 消息过期，DLX 转发到处理队列 | 定时扫描器发现到期记录 | Broker 调度，自动投递到原 Topic | 调度器到点重新发送 | 轮询器 ZRANGEBYSCORE 取出后 XADD 到目标 Stream | 调度器到点 publish 到 Subject | Broker 到期后将消息投递到目标队列 |
| 消费 | 关闭订单消费者订阅处理队列 | 消费者处理到期消息 | 普通消费者正常消费 | 消费者处理到期消息 | 消费组正常 XREADGROUP 消费 | JetStream 消费者正常拉取 | 普通消费者正常消费 |

## 脚注：同名异义

- **「延迟消息」**：RocketMQ 指 Broker 原生消息类型（Delay），语义是「指定投递时间戳」；RabbitMQ 语境下的「延迟」其实是 TTL 过期 + 死信转发的副作用，语义是「过期后换个地方投」——两者的精度、到期行为、能否与顺序/事务组合都不同，不可互相类比。
- **「延迟档位 vs 任意时间戳」**：RocketMQ 经典版本（4.x）是固定延迟档位（level 1~18），5.x 支持任意投递时间戳；比较「支持延迟消息」时必须说明是哪一种（checkedAt: 2026-08-19，本仓库基线为 RocketMQ 5.5.0）。
- **「延迟消息 vs 定时任务」**：延迟消息只保证「到点投递」，不保证「到点执行业务」——消费者宕机时仍会走正常的积压/重试路径。它不是调度系统（如 cron/工作流引擎）的替代品。

## 相关页面

- 到期后失败怎么办：[重试与 DLQ](/matrix/retry-dlq)
- RocketMQ 消息类型全貌：[RocketMQ 核心概念映射](/brokers/rocketmq/concepts)
- RabbitMQ TTL/DLX 细节：[RabbitMQ 路由与分发](/brokers/rabbitmq/routing)
