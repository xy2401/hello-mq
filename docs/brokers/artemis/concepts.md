# ActiveMQ Artemis 核心概念映射

> 本页结论：用 Artemis 的术语回答统一知识模型的十二个维度；同名概念（Queue、ACK、subscription）与其它产品的差异一律用脚注说明。

## 实体映射

| 统一模型 | ActiveMQ Artemis | 说明 |
| :--- | :--- | :--- |
| Message / Record | Message（JMS TextMessage 等） | 消息头 + 属性（properties）+ 载荷；本仓库用 TextMessage 存完整信封 JSON |
| Topic / Partition | Address + Queue | Address 是路由单元（anycast/multicast）；Queue 挂在其下承载消息。**Queue 无分区概念** |
| Subscription / Consumer Group | Queue（anycast）/ Subscription（multicast） | anycast 地址上的队列即竞争消费单元；multicast 的每个订阅是一个 durable queue |
| Consumer | JMS MessageConsumer | 会话内创建；同队列多消费者按轮转分发 |
| Offset / Cursor | 不适用 | 队列模型无消费位点概念；「已消费」= 已确认删除 |
| ACK | `Message.acknowledge()` / 事务 commit | CLIENT_ACKNOWLEDGE 确认会话内已收消息；确认后消息从队列删除 |
| Visibility / Pending | 未确认消息 | 仍在队列中，会话 recover 或断开连接后重投给其他消费者 |

## 核心操作速查

| 操作 | 方式 |
| :--- | :--- |
| 发送（同步确认） | CORE/JMS `producer.send(msg)` 阻塞至 Broker 确认（confirmation window） |
| 定时投递 | 消息属性 `_AMQ_SCHED_DELAY=<毫秒>` |
| 生产端去重 | 消息属性 `_AMQ_DUPL_ID=<业务 ID>` + 地址的 duplicate-id-cache-size |
| 消费确认 | `Session.CLIENT_ACKNOWLEDGE` + `message.acknowledge()` |
| 请求重投 | 不 ack + `session.recover()`（或关闭会话）；服务端按 address-setting 控制节奏 |
| 服务端策略 | `broker.xml` 的 `<address-setting match="...">`：重投次数/间隔、死信、过期、分页 |
| 消息分组保序 | 属性 `_AMQ_GROUP_ID=<组>`：同组消息粘连同一消费者 |
| 管理观察 | Web 控制台（8161）、JMX、`artemis queue stat`、`QueueBrowser` |

## 十二维度逐一回答

1. **定位**：多协议（JMS/AMQP/STOMP/MQTT/CORE）传统 Broker；首先是「企业任务分发与 JMS 兼容」。
2. **核心实体**：见上表；Address 的路由类型（anycast/multicast）在创建时或自动创建时决定。
3. **路由**：anycast 点对点、multicast 发布订阅；另有 divert（地址间转发）、selector（SQL 式过滤）、通配符安全匹配，详见 [路由与分发](/brokers/artemis/routing)。
4. **存储与保留**：消息写入 journal（追加日志）；**确认即删除**，无按时间回放；地址满时按 address-full-policy 分页（paging）到磁盘。
5. **生产可靠性**：同步 send 阻塞至 Broker 确认并落盘；`_AMQ_DUPL_ID` 提供生产端去重窗口；XA 事务可跨「收-处理-发」原子化。
6. **消费可靠性**：确认前消息一直在队列；消费者崩溃/断连后消息重投；重投节奏与上限由服务端 address-setting 决定。
7. **投递语义**：默认 at-least-once；配合幂等落库达成业务级恰好一次；Broker 内 XA 事务可实现原子处理（见 [可靠性](/brokers/artemis/reliability)）。
8. **顺序**：单队列单消费者严格 FIFO；竞争消费打破全局顺序，`_AMQ_GROUP_ID` 可做同组粘连。
9. **失败处理**：服务端原生：`max-delivery-attempts` + `redelivery-delay`（可乘退避）+ `dead-letter-address`；毒消息耗尽后自动转入死信地址（[实验](/brokers/artemis/#动手实验)）。
10. **高可用与扩展**：live/backup 复制对（同步复制 + 仲裁）或共享存储；集群把 Queue 分布到多节点并做重分配，见 [存储与高可用](/brokers/artemis/storage-ha)。
11. **安全与可观测**：基于角色（role）的地址级授权；hawtio 控制台 + JMX + 指标插件，见 [运维与观测](/brokers/artemis/operations)。
12. **限制与反模式**：见 [陷阱与检查表](/brokers/artemis/pitfalls)。

## 不可直接等价之处

- **Queue ≠ Kafka Partition**：队列是竞争消费单元，不做分区；吞吐扩展靠集群分布多个队列，而不是拆分单个队列。
- **acknowledge ≠ XACK**：Artemis 确认即**删除消息**（队列模型），Redis Streams 的 XACK 不删条目。
- **Subscription ≠ Kafka Consumer Group**：multicast 订阅是独立 durable queue（各收全量）；anycast 队列上的多消费者才对应「消费组」心智。
- **回放不可用**：没有 offset 重置；如需重放，必须在上游重发或预建 non-destructive 队列（特殊场景）。
- **重试是服务端配置**：与 RocketMQ 消费组重试策略同类，但配置位置是 broker.xml 的 address-setting，而非客户端或控制台动态下发（本仓库版本）。
