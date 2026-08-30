# RabbitMQ 核心概念映射

> 本页结论：用 RabbitMQ 的术语逐一回答统一知识模型的十二个维度，并区分 Virtual Host / Connection / Channel / Exchange / Queue / Binding 的职责。

## 实体关系

```mermaid
flowchart TB
  subgraph vhost[Virtual Host "/" （隔离边界：实体 + 权限）]
    X{{Exchange}} -- "Binding（routing key）" --> Q[(Queue)]
  end
  P[Producer] -- "Connection → Channel" --> X
  Q -- "Channel：deliver / ack" --> C[Consumer]
```

- **Virtual Host（vhost）**：逻辑隔离单元。Exchange、Queue、Binding、用户权限都属于某个 vhost。生产环境常按应用或环境分 vhost，避免命名冲突与越权。
- **Connection**：一条 TCP 长连接，建立成本高（TLS 握手、认证）。
- **Channel**：Connection 上复用的逻辑通道，发布、消费、声明实体都在 Channel 上进行。一个 Connection 开几十个 Channel 是常态；Channel 非线程安全，避免多线程共享一个 Channel。
- **Producer 不直接写 Queue**：消息总是发布到 Exchange，由 Exchange 按类型与 Binding 决定进入哪些队列。发到不存在的 Exchange 会关闭 Channel。
- **Binding**：Exchange 到 Queue 的路由规则。同一 Exchange 可绑定多个队列，同一队列可被多个 Exchange 绑定。

## 十二维度映射

### 1. 定位与适用场景

传统消息队列 + 灵活路由：任务分发、事件广播、按模式路由。不是日志，不是流（RabbitMQ Streams 插件是另一套实体，见 [存储与高可用](/products/rabbitmq/storage-ha)）。

### 2. 核心实体

Producer、Exchange、Queue、Consumer、Message。无「Topic 即队列」概念——订阅者通过绑定关系间接关联 Exchange。

### 3. 路由与分发

见专页 [路由与分发](/products/rabbitmq/routing)：Default / Direct / Topic / Fanout / Headers 五种 Exchange。

### 4. 存储与保留

消息存在 Queue（内存 + 可选落盘）。**ACK 后消息即被删除**，无按位点回放。保留期由 TTL、队列最大长度等参数控制，而不是「保留多久」的时间轴语义。

三个容易混淆的职责：

| 机制 | 回答的问题 | 失效场景 |
| :--- | :--- | :--- |
| Durable Queue | Broker 重启后队列**定义**还在吗？ | 不保证消息内容 |
| Persistent Message（deliveryMode=2） | 这条消息要不要尝试落盘？ | 落盘时机由 Broker 决定，不保证同步刷盘 |
| Publisher Confirms | Broker **收没收到**这条消息？ | 不保证之后不丢、更不保证被消费 |

三者叠加显著降低丢失概率，但「队列 durable + 消息 persistent」在单节点磁盘故障、未确认刷盘路径下**并非绝对不丢**；真正的多数派持久化要靠 Quorum Queue。

### 5. 生产可靠性

`confirmSelect()` 后 Broker 对每条消息回 ack/nack；本仓库 Demo 逐条 `waitForConfirms`。批量确认吞吐更高但要自己跟踪未确认集合。发送端重试可能造成重复，下游需幂等。

### 6. 消费可靠性

手动 ACK 模式下：ACK 移除消息；NACK/Reject 可选 requeue 或进 DLX；消费者断开未 ACK 的消息自动重投（redelivered=true）。Prefetch（basicQos）限制未 ACK 的在途数量，是负载均衡与公平分发的关键。

### 7. 投递语义

- at-most-once：自动 ACK（收到即确认），崩溃即丢。
- at-least-once：Publisher Confirms + 手动 ACK 的标准组合。
- exactly-once：**不适用于跨系统端到端**；业务侧用幂等消费达成「效果一次」。

### 8. 顺序语义

单队列内 FIFO；但 NACK+requeue、DLX 回环、多消费者乱序 ACK 都会打乱顺序。需要严格顺序时通常单队列 + 单消费者，并接受吞吐上限。详见 [顺序语义](/#mq-ordering)。

### 9. 失败处理

无内置消费重试。模式：TTL + DLX 重试环、延迟重投、DLQ 隔离。见 [可靠性](/products/rabbitmq/reliability)。

### 10. 高可用与扩展

Quorum Queue（Raft 多数派）为现代默认；Classic Queue 单副本；Stream 用于大积压/回放场景。详见 [存储与高可用](/products/rabbitmq/storage-ha)。

### 11. 安全与可观测性

认证（PLAIN/AMQPLAIN/证书）、vhost 级与实体级权限（正则匹配 configure/write/read）、TLS。指标：management API / Prometheus 插件，核心指标见 [运维与观测](/products/rabbitmq/operations)。traceId 经消息 headers 传播（本仓库 Demo 已贯穿 producer/consumer 日志）。

### 12. 限制与反模式

见专页 [陷阱与检查表](/products/rabbitmq/pitfalls)。

## 三层语义示例：「消息不会丢」

| 层级 | RabbitMQ 的成立条件 |
| :--- | :--- |
| Broker 层 | Quorum Queue 多数派落盘后确认；或单节点下消息已持久化且节点存活 |
| Client 层 | Producer 开启 Confirms 并处理 nack；Consumer 手动 ACK，处理完成才确认 |
| Business 层 | 业务写入与幂等记录同事务；DB 提交后才 ACK（崩溃窗口见 [可靠性](/products/rabbitmq/reliability)） |

## 官方资料

- AMQP 0-9-1 Model：<https://www.rabbitmq.com/tutorials/amqp-concepts>（checkedAt: 2026-08-19）
- Queues：<https://www.rabbitmq.com/docs/queues>（checkedAt: 2026-08-19）
- Access Control / vhost：<https://www.rabbitmq.com/docs/access-control>（checkedAt: 2026-08-19）
