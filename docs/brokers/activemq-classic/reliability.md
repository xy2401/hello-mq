# ActiveMQ Classic 可靠性

> 本页结论：Classic 的可靠性骨架是「persistent send 落盘确认 + commit 后删除 + Broker 端强制执行的重投策略」。重投策略由客户端经连接 URL 声明（`jms.redeliveryPolicy.*`）；毒消息耗尽后自动进默认共享死信 ActiveMQ.DLQ，无需任何 broker 配置。

## 生产端：持久与确认

**默认持久、同步确认**。JMS `producer.send(msg)` 默认 PERSISTENT，阻塞直到 Broker 确认收到（持久消息已写 KahaDB）。返回即代表单节点写入成功——这是本仓库 `status=confirmed` 的含义。

**事务发送**。事务会话内一次 `commit` 原子发送多条消息；与消费侧事务同属 JMS 本地事务，Broker 内原子。

**定时投递**。属性 `AMQ_SCHEDULED_DELAY=<毫秒>` 让消息延迟可见，但需要 broker 开启 `schedulerSupport=true`（官方文档 E1；镜像默认 conf 未开启，使用前先确认配置）。

## 消费端：commit 即删除与崩溃窗口

本仓库实验用 `Session.SESSION_TRANSACTED` 会话，处理顺序固定：

```text
receive → 业务写库（sqlite 事务提交）→ session.commit()（确认并删除）
```

崩溃窗口与其它队列型 Broker 同构：

- **业务提交前崩溃**：消息未 commit，仍在队列 → 重投，业务侧靠幂等表拦截重复；
- **commit 后、下一轮前崩溃**：无损失；
- **业务提交后、commit 前崩溃**：消息重投 → 幂等表命中 `duplicate_skipped`。这是「至少一次 + 幂等」的标准形态。

错误做法：`AUTO_ACKNOWLEDGE` 会话让客户端在回调返回时自动确认——业务失败即丢消息，生产禁用。

## 重投：redeliveryPolicy（客户端声明、Broker 执行）

重投策略不经 broker.xml，而是客户端经连接 URL 下发、由 Broker 端强制执行（本仓库 retry-dlq 实验实测）：

```text
tcp://activemq:61616?jms.redeliveryPolicy.maximumRedeliveries=2&jms.redeliveryPolicy.initialRedeliveryDelay=1000
```

- **计数口径**：`maximumRedeliveries` 计「重投次数」，**不含首次投递**——设 2 实测共投递 3 次（与 Artemis `max-delivery-attempts=3` 对齐）；官方默认值为 6（E1：Redelivery Policy）。
- 触发方式：消费者 `session.rollback()`（或断连、未 commit 关闭会话）；`initialRedeliveryDelay` 默认 1s，可配指数退避（默认关闭）。
- 与 Artemis 的差异在配置位置（客户端 URL vs broker.xml address-setting），「服务端强制执行」的性质相同。

## 死信：默认共享 ActiveMQ.DLQ

- 重投耗尽后消息**自动**转入默认死信队列 `ActiveMQ.DLQ`——无需任何 broker 配置（本仓库实测：dlq-consumer 从 ActiveMQ.DLQ 收到毒消息）；
- `ActiveMQ.DLQ` 是全 broker **共享**的：所有队列的毒消息混在一起，告警无法区分业务线。按目的地拆分专属 DLQ 用 destinationPolicy 的 `individualDeadLetterStrategy`（官方文档 E1：Message Redelivery and DLQ Handling）；
- **非持久消息默认不进 DLQ**（`processNonPersistent` 默认关闭，耗尽/过期直接丢弃）——依赖 DLQ 兜底就必须发送 persistent 消息。

## 实验与观察点

- `activemq-classic basic`（L1）：persistent 确认 → 业务提交 → session.commit() → 队列深度归零，验证 commit 即删除与幂等落库。
- `activemq-classic retry-dlq`（L2）：毒消息 rollback 后共投递 3 次（`poisonMaxAttempt=3`），耗尽进 ActiveMQ.DLQ（`dlqReceived=1`）。

<LabOutput product="activemq-classic" lab="retry-dlq" />

运行：`bash demos/activemq-classic/basic/run.sh`、`bash demos/activemq-classic/retry-dlq/run.sh`。

## 边界

- 队列无消费位点：不存在「跳过坏消息继续」的位点操作，毒消息必须靠重试上限 + DLQ 清出。
- 重投计数随消息累计（JMSXDeliveryCount 可见当前是第几次投递）。
- AMQP/STOMP/MQTT 协议接入时，确认映射为各自的 ack/disposition，语义一致但 API 不同。
