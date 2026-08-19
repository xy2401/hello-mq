# ActiveMQ Artemis 可靠性

> 本页结论：Artemis 的可靠性骨架是「同步 send 落盘确认 + 确认后删除 + 服务端重投策略」。生产端用阻塞 send 与 `_AMQ_DUPL_ID` 去重，消费端业务提交后才 acknowledge；重投次数、间隔与死信地址全部由 broker.xml 的 address-setting 决定。

## 生产端：确认与去重

**同步确认**。CORE/JMS 客户端的 `send` 在 confirmation window 内阻塞，直到 Broker 确认收到（持久消息已写 journal）。返回即代表单节点写入成功——这是本仓库 `status=confirmed` 的含义。

**生产端去重**。消息属性 `_AMQ_DUPL_ID=<业务唯一 ID>`：Broker 在地址级 duplicate-id-cache 窗口内丢弃重复 ID 的消息。发送端重试时带上同一 ID，即可安全重发：

- 缓存大小由地址设置 `duplicate-id-cache-size` 控制，窗口外不再去重；
- 与 RocketMQ 的无内置去重、NATS 的 `Nats-Msg-Id` 窗口同类，都是「有界窗口」而非永久幂等。

**定时投递**。`_AMQ_SCHED_DELAY=<毫秒>` 让消息延迟可见，属服务端调度，不占客户端线程（对比：Redis Streams 无原生延迟，需 ZSET 自建）。

## 消费端：ack 即删除与崩溃窗口

`Session.CLIENT_ACKNOWLEDGE` 下，`message.acknowledge()` 之前的所有已收消息视为确认并**从队列删除**：

```text
receive → 业务写库（事务提交）→ acknowledge
```

崩溃窗口与其它队列型 Broker 同构：

- **业务提交前崩溃**：消息未确认，仍在队列 → 重投，业务侧靠幂等表拦截重复；
- **ack 后、下一轮前崩溃**：无损失；
- **业务提交后、ack 前崩溃**：消息重投 → 幂等表命中 `duplicate_skipped`。这是「至少一次 + 幂等」的标准形态。

错误做法：`AUTO_ACKNOWLEDGE` 会话让客户端在回调返回时自动确认——业务失败即丢消息，生产禁用。

## 重投与死信：服务端策略

重投不由客户端决定，address-setting 按地址通配匹配：

```xml
<address-setting match="orders-retry">
  <max-delivery-attempts>3</max-delivery-attempts>   <!-- 共投递 3 次（1 初始 + 2 重投） -->
  <redelivery-delay>1000</redelivery-delay>          <!-- 首次重投前等待 -->
  <redelivery-multiplier>1.0</redelivery-multiplier> <!-- 递增系数，1.0 = 固定间隔 -->
  <dead-letter-address>orders-dlq</dead-letter-address>
</address-setting>
```

- 消费者不 ack（`session.recover()` 或断连）触发重投；达到 `max-delivery-attempts` 后消息**自动转入死信地址**。
- 死信地址是普通 anycast 地址：独立消费者收出、告警、修复后重发，形成标准 DLQ 流程。
- 与 RocketMQ（消费组重试策略 + %DLQ% 组 Topic）语义同构，配置位置不同；与 RabbitMQ（队列级死信交换）相比，Artemis 死信按地址匹配，粒度更细。

## 事务：跨收发的原子性

- **本地事务会话**：一次 commit 内原子完成「确认已收消息 + 发送新消息」，Broker 内恰好一次；
- **XA（JTA）**：把 Broker 事务纳入全局事务，与数据库两阶段提交协同——这是 Artemis 相对多数云原生 Broker 的差异化能力；
- 事务不等于端到端 exactly-once：业务库与 Broker 之外的副作用仍需幂等设计。

## 实验与观察点

- `artemis basic`（L1）：同步确认 → 业务提交 → acknowledge → 队列深度归零，验证 ack 即删除与幂等落库。
- `artemis retry-dlq`（L2）：毒消息按 address-setting 重投 3 次后进入 `orders-dlq`，独立消费者收出核对。

运行：`npm run lab -- artemis basic`、`npm run lab -- artemis retry-dlq`（验证快照尚未采集，输出以实际运行为准）。

## 边界

- 重投计数按**消息**累计，跨消费者共享；换消费者不会重置次数。
- 队列无消费位点：不存在「跳过坏消息继续」的位点操作，毒消息必须靠重试上限 + DLQ 清出。
- AMQP/MQTT 协议接入时，确认映射为各自的 disposition/ack，语义一致但 API 不同。
