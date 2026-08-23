# RabbitMQ 陷阱与检查表

> 本页结论：汇总 RabbitMQ 的默认值陷阱与错误类比，给出一份可逐项打钩的生产上线检查表。

## 默认值陷阱

| 默认行为 | 陷阱 | 正确做法 |
| :--- | :--- | :--- |
| 不开 Publisher Confirms | `basicPublish` 不报错 ≠ Broker 收到 | `confirmSelect()` + 处理 nack |
| 自动 ACK（autoAck=true） | deliver 即删除，崩溃丢消息 | 手动 ACK，业务提交后才确认 |
| 不设 Prefetch | 消息被一次性推给单个消费者 | `basicQos(1)` 或按处理能力设置 |
| guest 账号 | 仅限 localhost，常被误用于远程 | 独立账号 + 最小权限 |
| Classic Queue 单副本 | 节点故障消息不可用 | 生产用 Quorum Queue |
| 队列级 TTL | 全队列统一过期时间 | 按业务分级建队列；per-message TTL 注意队头计算 |
| mandatory 未开启 | 路由不到队列的消息被静默丢弃 | 开 mandatory + basicReturn，或绑兜底队列 |

## 错误类比与禁止表述

以下表述在本仓库视为错误：

1. **「队列 durable + 消息 persistent 就绝对不丢」**
   真相：这两项只覆盖「Broker 正常重启」场景。单节点磁盘损坏、未落盘前崩溃都会丢；多数派持久化要靠 Quorum Queue，且确认语义随队列类型变化。

2. **「Publisher Confirm 表示消费者已经处理」**
   真相：Confirm 只是 Broker 的接收回执，与消费侧 ACK 完全独立。业务成功与否只有消费端的业务事务能证明。

3. **「所有 RabbitMQ 队列都适合超长积压或日志回放」**
   真相：Classic/Quorum 是队列语义（ACK 即删），长积压消耗内存并触发流控；回放需求应评估 RabbitMQ Streams 或日志型系统。

其他常见错误类比：

- 「RabbitMQ 的 DLX = Kafka 的 retry topic = RocketMQ 的重试队列」——三者机制不同：RabbitMQ 靠队列参数组合，Kafka 是应用层模式，RocketMQ 是 Broker 内置（详见后续横向矩阵）。
- 「Queue 就是 Kafka 的 Partition」——队列有 ACK 删除语义，分区是日志；消费模型不可互译。

## 反模式清单

- 用 NACK+requeue 当无限重试：毒消息卡队头，CPU 空转。→ 用 [TTL+DLX 重试环](/playground/poison-message)。
- 一个队列塞所有事件类型，消费者里 if/else 分发：路由责任上移到 Exchange。
- 把 Broker 事务当跨系统事务：事务消息不覆盖下游数据库/HTTP 副作用。→ Outbox + 幂等消费。
- 消费者处理几秒还开 autoAck + 大 prefetch：丢失窗口与负载不均双重放大。
- 用消息体传大数据：Broker 内存与网络被撑爆；传引用，不传本体。
- 拓扑声明散落在各服务且参数不一致：同名队列不同参数会声明失败（PRECONDITION_FAILED）。→ 拓扑收敛到部署流程。

## 生产上线检查表

- [ ] 生产端：Publisher Confirms 开启，nack/超时有补偿路径（重试或 Outbox）。
- [ ] 消费端：手动 ACK，业务事务提交后才 ACK；prefetch 已按处理能力设置。
- [ ] 幂等：`messageId` 唯一键表与业务写入同事务；已验证重投场景（本仓库 [consumer-crash 实验](/playground/consumer-crash) 可复用为验收用例）。
- [ ] 失败路径：最大重试次数 + DLQ + DLQ 告警；毒消息有处理预案。
- [ ] 队列类型：生产可靠队列使用 Quorum Queue（≥3 副本），并理解多数派不可用时队列不可用。
- [ ] 资源：内存/磁盘 watermark 与告警配置；积压增长趋势有监控。
- [ ] 安全：非 guest 账号、最小权限、TLS；管理端口不暴露公网。
- [ ] 观测：ready/unacked/速率/redeliver/DLQ 深度有看板；traceId 贯穿两端日志。
- [ ] 版本：镜像与客户端版本锁定（参考本仓库 `.env.versions` 的 tag+digest 双锁）。
- [ ] 容量评估：峰值生产速率、可接受积压时长、消费者扩容方式已压测（不把单机 Demo 数字当生产基准）。

## 官方资料

- Reliability Guide：<https://www.rabbitmq.com/docs/reliability>（checkedAt: 2026-08-19）
- Production Checklist：<https://www.rabbitmq.com/docs/production-checklist>（checkedAt: 2026-08-19）
