# NATS 陷阱与检查表

> 本页结论：NATS 的坑集中在「把 Core 当可靠通道」「把 JetStream 当 Kafka 分区日志」「AckWait 设置不当造成重投风暴」三处；分层语义想清楚，其余都是参数问题。

## Core 与 JetStream 混用陷阱

1. **「NATS 消息不会丢」**——必须追问哪一层：Core 层无订阅者即丢、断线窗口即丢；只有 JetStream 有持久化（本仓库 `core-pubsub` 实验实证了丢失）。
2. **「Queue Group 是可靠工作队列」**——Queue Group 无位点无存储，成员全离线时消息丢弃；可靠工作队列用 JetStream WorkQueue 策略 Stream。
3. **「publish 成功 = 服务端已处理」**——Core `publish` 没有任何服务端应答；`flush` 也只证明字节到达。只有 `JetStream.publish` 的 PublishAck 才是写入确认。

## 默认值与参数陷阱

| 默认/配置 | 风险 | 建议 |
| :--- | :--- | :--- |
| Stream 未设 max_age/max_bytes | 存储无限增长直至配额写满 | 建 Stream 时显式给保留上限并说明依据 |
| AckWait 过短（默认 30s） | 慢处理被误判超时 ⇒ 重复投递风暴 | AckWait > P99 处理时长；幂等必须就位 |
| MaxDeliver 默认 -1（无限） | 毒消息永远重投 | 显式设置上限 + DLQ Stream |
| Pull Consumer fetch 超时长阻塞 | 吞吐低、关闭慢 | 批量 fetch + 合理超时 |
| Memory 存储 | 重启丢消息 | 可靠消息一律 File 存储 + 持久卷 |
| R1 副本 | 单节点故障即不可用/可能丢数据 | 生产 R3 |

## 错误类比（常见误区）

- **「Stream 就是 Topic，Consumer 就是 Consumer Group」**——Stream 没有分区：单个 Stream 的消费并行受「多客户端共享 Consumer」约束，但没有分区键与分区级有序模型（与 Kafka 不等价）。
- **「Interest 策略下也能回放」**——Interest/WorkQueue 会在消费后删除消息，回放窗口取决于删除时机；回放需求用 Limits 策略。
- **「NATS 集群 = JetStream 高可用」**——Cluster 只解决连接与路由；JetStream 可用性取决于 Stream 副本数（R1/R3）。

## 不适用场景

- 分区级大规模并行事件流（Kafka/Pulsar 更合适）。
- 复杂服务端内容过滤（Tag/Header 级路由）：NATS 是 Subject 匹配 + Consumer Filter Subject。
- 需要消息级延迟语义之外的企业队列特性（如 RabbitMQ 的 DLX 组合灵活性）时，评估 DLQ 自建成本。

## 生产检查表

- [ ] 明确每条链路用 Core 还是 JetStream，可靠性结论分层书写。
- [ ] JetStream Stream：File 存储 + R3 + 显式保留上限。
- [ ] Consumer：AckWait 覆盖 P99 处理时长；MaxDeliver 有限 + DLQ Stream 就位。
- [ ] 消费端幂等键就位（重投必然发生）。
- [ ] 生产端重试场景使用 Msg-Id 利用服务端去重窗口。
- [ ] 认证（NKey/JWT）+ TLS + Subject 级授权已启用。
- [ ] 监控：slow_consumers、num_pending、ack_pending、存储配额水位。
- [ ] 备份/恢复：`nats stream backup` 纳入运维流程（关键 Stream）。

## 一句话总结

NATS 的价值是「一个二进制同时给你总线与事件流」；代价是必须时刻分清两层的语义边界——凡是把 Core 的轻量结论套到 JetStream、或把 JetStream 的持久结论套到 Core 的设计，都会在故障时付出学费。
