# 生产上线检查表

> 本页结论：上线检查分「通用项」与「产品专属项」两层。本页汇总通用项：版本锁定、生产可靠投递与幂等、重试与 DLQ 告警、统一观测、安全基线、容量与压测记录、备份与演练；产品专属项在各产品分卷的陷阱与检查表页逐项核对。每一项都链接到本仓库给出依据的页面——检查表不是背书清单，打钩前应先读对应页面确认理解了边界。

## 1. 版本锁定

- [ ] 不使用 `latest`/`edge`/`nightly` 等浮动镜像标签；镜像同时锁定 Tag 与 Digest。
- [ ] 客户端 SDK 版本锁定并记录在案；文档中的 API 与行为标注适用版本。
- [ ] 升级 Broker 遵循流程：独立分支更新镜像/客户端/快照 → 核对语义变化 → 再改文档结论。
- [ ] 「当前最新」「默认值」类表述带核对日期；每季度（或安全事件时）核对官方支持版本。

依据：[版本政策](/reference/version-policy)（规格 §11.1）。

## 2. 生产侧：可靠投递

- [ ] 生产者启用并正确处理发布确认（publisher confirm / acks=all + 幂等 producer / sendResult 回调）。
- [ ] 「业务写入 + 消息发送」不是裸双写：采用 [Outbox](/patterns/outbox)（或 RocketMQ 事务消息等等价机制），明确失败窗口归属。
- [ ] 消息使用统一信封（规格 §5.2）：messageId 全局唯一、eventType 语义化、schemaVersion、traceId/correlationId 全链路。
- [ ] 契约变更走兼容演进流程（见 [Schema 演进](/patterns/schema-evolution)）；破坏性变更有升版本与共存过渡方案。

## 3. 消费侧：幂等、重试与 DLQ

- [ ] 消费者按 [§5.4 基准实现](/patterns/idempotent-consumer)：幂等键与业务写入同事务，确认动作在事务提交之后。
- [ ] 手动确认（ACK / 手动提交 offset），确认时机有明确代码位置与注释。
- [ ] 重试有上限与延迟策略；毒消息路径验证过（参考实验[毒消息、重试与 DLQ](/labs/poison-message)）。
- [ ] DLQ 已建立且有告警：深度、新增速率、最老消息年龄；回放流程演练过一次。
- [ ] 崩溃重投已演练（参考实验[消费者崩溃与重投](/labs/consumer-crash)）：确认重复只产生 duplicate_skipped，不产生重复业务写入。

## 4. 观测与告警

- [ ] 六组统一指标全部可查：生产确认率、消费与积压（mq_backlog）、重投率、DLQ 深度、端到端事件年龄、Broker 资源（见[可观测性](/operations/observability)）。
- [ ] 日志包含 §12.2 统一字段，traceId/correlationId 贯穿 Producer 与 Consumer。
- [ ] 积压预算已设定并接入告警；告警有责任人。
- [ ] 故障处置走[故障剧本](/operations/failure-playbook)，值班同学知道四张表的位置。

## 5. 安全基线

- [ ] 生产启用 TLS 且验证服务端身份；管理端口与数据端口分离并限制访问。
- [ ] 每个服务独立身份，按 Topic/Queue 最小授权（见[安全基线](/operations/security)三件套对照表）。
- [ ] Demo 默认账号与匿名访问已禁用（guest/guest、PLAINTEXT 无认证等——实验环境豁免项在生产全部是禁止项）。
- [ ] 秘密不进仓库、URL、日志与快照；Payload 敏感字段已分类脱敏。
- [ ] 证书/密钥轮换流程与审计日志就位。

## 6. 容量与压测

- [ ] 存储按「峰值速率 × 保留期 × 副本数 × 冗余系数」计算过（见[容量规划](/operations/capacity-planning)）。
- [ ] 吞吐余量 ≥ 2 倍峰值；消费者扩容路径已验证（并行度单位：分区/队列/消费者关系）。
- [ ] 压测报告按规格 §12.4 记录完整环境，标题为「该固定环境下的实验结果」；未把单机 Demo 数字当生产基准。
- [ ] 磁盘/内存水位双阈值告警（预警线 + 强制动作线）。

## 7. 备份与演练

- [ ] 有备份：Broker 元数据（RabbitMQ definitions、Kafka 元数据/分区布局、RocketMQ 路由信息、Pulsar 元数据）与消息存储的备份策略明确。
- [ ] 恢复演练至少执行过一次，并记录恢复耗时。
- [ ] 故障演练至少覆盖：消费者崩溃重投、毒消息进 DLQ、一次计划内的 Broker 重启积压追赶。
- [ ] DLQ 回放与数据补偿流程有文档、有权限控制。

## 8. 产品专属检查表

通用项之外，各产品的默认值陷阱与专属检查项在分卷页逐项核对：

| 产品 | 检查表 |
| :--- | :--- |
| RabbitMQ | [陷阱与检查表](/brokers/rabbitmq/pitfalls) |
| Kafka | [陷阱与检查表](/brokers/kafka/pitfalls) |
| RocketMQ | [陷阱与检查表](/brokers/rocketmq/pitfalls) |
| Pulsar | [陷阱与检查表](/brokers/pulsar/pitfalls) |

## 常见误区

- 「检查表打完钩就安全了」——检查表验证的是「配置了」，不是「理解了」；每一项背后的失败窗口（如 Outbox 的提交顺序、幂等表与业务的同事务要求）才是事故根因。
- 「演练过一次就够了」——人员、版本、拓扑都在变，恢复与回放演练应周期性重做。
- 「观测上线后补」——没有 mq_backlog 与重投率就敢放量，等于盲开。

## 官方资料

- RabbitMQ Production Checklist：<https://www.rabbitmq.com/docs/production-checklist>（checkedAt: 2026-08-19）
- Kafka Operations：<https://kafka.apache.org/documentation/#ops>（checkedAt: 2026-08-19）
- RocketMQ 最佳实践入口：<https://rocketmq.apache.org/docs/bestPractice/01bestpractice/>（checkedAt: 2026-08-19）
- Pulsar 文档入口：<https://pulsar.apache.org/docs/>（checkedAt: 2026-08-19）
