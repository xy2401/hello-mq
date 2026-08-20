# ActiveMQ Classic 核心概念映射

> 本页结论：用 Classic 的术语回答统一知识模型的十二个维度；同名概念（Queue、commit、subscription）与其它产品的差异一律用脚注说明。

## 实体映射

| 统一模型 | ActiveMQ Classic | 说明 |
| :--- | :--- | :--- |
| Message / Record | Message（JMS TextMessage 等） | 消息头 + 属性（properties）+ 载荷；本仓库用 TextMessage 存完整信封 JSON |
| Topic / Partition | Queue / Topic 目的地 | Queue 点对点、Topic 发布订阅。**两者都无分区概念** |
| Subscription / Consumer Group | Queue（竞争消费）/ durable subscription（Topic） | Queue 上的多消费者即竞争消费单元；Topic 每个 durable 订阅各留一份 |
| Consumer | JMS MessageConsumer | 会话内创建；同队列多消费者轮转分发 |
| Offset / Cursor | 不适用 | 队列模型无消费位点概念；「已消费」= 已确认删除 |
| ACK | `session.commit()`（事务会话）/ acknowledge | 本仓库用 SESSION_TRANSACTED：commit 确认会话内已收消息并从队列删除 |
| Visibility / Pending | 未 commit / 已 rollback 的消息 | 仍在队列中，rollback 或断连后按 redeliveryPolicy 重投 |

## 核心操作速查

| 操作 | 方式 |
| :--- | :--- |
| 发送（默认持久） | `producer.send(msg)` 默认 PERSISTENT，同步阻塞至 Broker 确认落 KahaDB |
| 定时投递 | 属性 `AMQ_SCHEDULED_DELAY=<毫秒>`（需 broker `schedulerSupport=true`） |
| 消费确认 | `Session.SESSION_TRANSACTED` + 业务提交后 `session.commit()` |
| 请求重投 | `session.rollback()`（或断连）；Broker 按客户端 redeliveryPolicy 强制执行 |
| 重试策略下发 | 连接 URL `jms.redeliveryPolicy.maximumRedeliveries/initialRedeliveryDelay` 等 |
| 死信 | 耗尽后默认自动进共享队列 `ActiveMQ.DLQ`；按目的地专属 DLQ 用 policyEntry 的 individualDeadLetterStrategy |
| 消息分组保序 | 属性 `JMSXGroupID=<组>`：同组消息粘连同一消费者 |
| 管理观察 | Web 控制台（8161）、JMX、`bin/activemq`（status/dstat/bstat/browse/query） |

## 十二维度逐一回答

1. **定位**：JMS 原生传统 Broker（OpenWire + AMQP/STOMP/MQTT/WS connector）；首先是「存量 Java/JMS 任务分发」。
2. **核心实体**：见上表；Queue/Topic 首次生产或消费时自动创建，无显式建队命令。
3. **路由**：Queue 点对点、Topic 发布订阅；另有 selector（SQL-92 子集过滤）、JMSXGroupID 组粘连、VirtualTopics（Topic 上挂竞争消费队列），详见 [路由与分发](/brokers/activemq-classic/routing)。
4. **存储与保留**：持久消息写 KahaDB（文件式追加存储）；**确认即删除**，无按时间回放；systemUsage 限额触发 producer flow control（背压）。
5. **生产可靠性**：persistent send 阻塞至 Broker 确认落盘；JMS 事务会话一次 commit 原子发送多条。
6. **消费可靠性**：commit 前消息一直在队列；rollback/断连后按 redeliveryPolicy 重投，次数与间隔由该策略决定（Broker 执行）。
7. **投递语义**：默认 at-least-once；配合幂等落库达成业务级恰好一次（见 [可靠性](/brokers/activemq-classic/reliability)）。
8. **顺序**：单队列单消费者严格 FIFO；竞争消费打破全局顺序，`JMSXGroupID` 可做同组粘连。
9. **失败处理**：`maximumRedeliveries`（计"重投次数"，默认 6）+ redelivery delay（默认 1s、可指数退避）；耗尽自动进默认共享 DLQ ActiveMQ.DLQ（[实验](/brokers/activemq-classic/#动手实验)）。
10. **高可用与扩展**：master/slave（共享文件系统或 JDBC 锁）；Networks of Brokers 做多节点队列分布，见 [存储与高可用](/brokers/activemq-classic/storage-ha)。
11. **安全与可观测**：默认配置匿名可连（镜像默认 conf 无认证插件），生产必须启用认证与授权；Web 控制台 + JMX，见 [运维与观测](/brokers/activemq-classic/operations)。
12. **限制与反模式**：见 [陷阱与检查表](/brokers/activemq-classic/pitfalls)。

## 不可直接等价之处

- **Queue ≠ Kafka Partition**：队列是竞争消费单元，不做分区；吞吐扩展靠 Networks of Brokers 分布多个队列，而不是拆分单个队列。
- **session.commit() ≠ offset commit**：Classic 的 commit 是「确认并**删除**消息」（队列模型），Kafka 的 offset 提交不删数据、可回拨重放。
- **durable subscription ≠ Kafka Consumer Group**：Topic 的每个 durable 订阅各收全量；Queue 上的多消费者才对应「消费组」心智。Topic 上需要竞争消费时用 VirtualTopics。
- **redeliveryPolicy 的配置位置**：由客户端经连接 URL/ConnectionFactory 声明（与 RocketMQ 消费组策略、Artemis 的 broker.xml address-setting 都不同），但执行方是 Broker——客户端改参数不需要动 broker 配置。
- **回放不可用**：没有 offset 重置；如需重放，必须在上游重发。
