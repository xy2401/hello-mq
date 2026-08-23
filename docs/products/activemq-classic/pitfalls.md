# ActiveMQ Classic 陷阱与检查表

> 本页结论：Classic 的大多数事故来自三类实测坑——maximumRedeliveries 计数口径（计"重投次数"不含首次投递，默认 6）、自带 consumer 无 receive-timeout（空队列无限阻塞）、默认 DLQ 为全 broker 共享的 ActiveMQ.DLQ——外加默认匿名访问与 admin/admin 控制台这两道必须处理的安全门。

## 默认值陷阱

| 默认行为 | 风险 | 建议 |
| :--- | :--- | :--- |
| 61616 OpenWire 默认匿名（默认 conf 无认证插件） | 任何能连端口的客户端可读写全部目的地 | 生产启用认证与目的地级授权，端口不对公网 |
| Web 控制台 admin/admin | 控制台可直接清队列、删消息 | 修改 jetty realm 凭据，8161 限内网 |
| `maximumRedeliveries` 默认 6 | 毒消息重投 6 次才进 DLQ，抖动时间长于预期 | 按业务显式声明 redeliveryPolicy |
| 共享 DLQ `ActiveMQ.DLQ` | 全队列毒消息混在一起，告警无法区分业务线 | policyEntry 的 individualDeadLetterStrategy 拆分 + 分目的地告警 |
| 非持久消息不进 DLQ | `processNonPersistent` 默认关闭，耗尽/过期直接丢弃 | 需要 DLQ 兜底的消息一律 persistent 发送 |
| 目的地自动创建 | 拼写错误留下野队列/野 Topic | 命名规约 + 控制台定期巡检清理 |
| `AUTO_ACKNOWLEDGE` 会话 | 回调返回即自动确认 → 业务失败即丢消息 | 生产一律 SESSION_TRANSACTED 或手动确认 |

## 三个实测坑（本仓库 E2）

1. **maximumRedeliveries 的计数口径**：计「重投次数」，**不含首次投递**——设 2 实测共投递 3 次（retry-dlq 实验 `poisonMaxAttempt=3`）。与 Artemis `max-delivery-attempts=3`（计总投递）对齐时要换算口径，照搬数字会多投或少投一次。
2. **自带 consumer 无 receive-timeout**：`bin/activemq consumer` 在空队列时无限阻塞，CLI 没有 receive 超时参数；脚本断言「队列已空」必须用 `timeout` 包裹并以 exit=124 为证据（cli-tools 实验 `verifyExit=124`），不能等它自行退出。
3. **共享 DLQ 是零配置的，也是零隔离的**：重投耗尽自动进 `ActiveMQ.DLQ`，无需任何 broker 配置（这是便利）；但所有队列共用一个 DLQ，深度告警分不清业务线，修复重发也要先甄别来源（见 [可靠性](/products/activemq-classic/reliability) 的死信一节）。

## 错误类比（常见误区）

1. **「Classic 可以当 Kafka 用」**——错在存储模型：确认即删除，没有位点、没有回放；需要重放必须上游重发（见 [存储与高可用](/products/activemq-classic/storage-ha)）。
2. **「Classic 与 Artemis 配置互通」**——两套代码库：Classic 是 XML（activemq.xml）+ 客户端 redeliveryPolicy，Artemis 是 broker.xml + address-setting；客户端、端口默认值、调优参数全不同。对照见 [Artemis 分卷](/products/artemis/)。
3. **「maximumRedeliveries=3 就是共投 3 次」**——错，共投 4 次（1 初始 + 3 重投）。
4. **「有 DLQ 就不会丢消息」**——非持久消息默认不进 DLQ；过期消息是否进 DLQ 也取决于策略配置。
5. **「master/slave 能扩吞吐」**——master/slave 只解决可用性；吞吐扩展靠多队列 + Networks of Brokers 分布。

## 不适用场景

- 长期保留与按时间回放：队列模型不支持，用分区日志产品。
- 单队列超高吞吐（>单节点能力）：无分区扩展路径，需业务拆队列或换日志型 Broker。
- 海量小 Topic 的 Pub/Sub 树（IoT 百万主题）：MQTT connector 可用但路由/安全模型为目的地设计，超大规模主题空间非其主场。
- 多租户平台：无内建租户模型，需实例级隔离。

## 生产检查表

- [ ] 认证与目的地级授权已启用；61616/8161 不对公网，控制台凭据已改。
- [ ] 消费会话为 SESSION_TRANSACTED 或手动确认；`AUTO_ACKNOWLEDGE` 未出现在生产代码。
- [ ] 每个业务队列有明确的 redeliveryPolicy（maximumRedeliveries 按「重投次数」口径理解）与 DLQ 策略；DLQ 深度告警已配置。
- [ ] 需要 DLQ 兜底的消息均为 persistent（非持久消息默认不进 DLQ）。
- [ ] 消费端幂等键已就位（重投必然发生，问题只是何时）。
- [ ] KahaDB 数据目录挂持久卷（低延迟本地盘优先）；master/slave 或备份策略已演练恢复。
- [ ] systemUsage 限额已按容量评估；producer flow control 触发有告警。
- [ ] 监控：队列深度、Enqueue/Dequeue 差值、ActiveMQ.DLQ 深度、memory/store 使用率、连接与消费者数。
- [ ] 容量评估以「单队列单节点」为前提，热点已按业务键拆队列或用 JMSXGroupID 粘连。
