# Apache RocketMQ 运维与观测

> 本页结论：看懂两个核心信号（消费堆积 Consume Diff、重试/DLQ 深度）就能覆盖大多数 RocketMQ 日常问题；本仓库 lab 用 `mqadmin consumerProgress` 的 Consume Diff 做 Broker 侧断言。

## 管理接口：mqadmin

管理命令经 broker 容器内 `mqadmin -n namesrv:9876` 执行（本仓库拓扑声明都走它）：

| 命令 | 用途 |
| :--- | :--- |
| `updateTopic -c <cluster> -t <topic> -a +message.type=...` | 建/改 Topic（声明消息类型） |
| `updateSubGroup -c <cluster> -g <group> [-r 次数] [-p 策略JSON]` | 建/改消费组（重试次数、重试策略） |
| `topicRoute -t <topic>` | 查 Topic 路由（队列分布在哪些 Broker） |
| `consumerProgress -g <group>` | 查消费组进度与 **Consume Diff**（堆积） |

本仓库 lab 框架在断言阶段调用（示例）：

```bash
docker compose -p <project> exec broker \
  sh mqadmin -n namesrv:9876 consumerProgress -g orders-basic-group
```

## 核心指标

| 指标 | 含义 | 异常信号 |
| :--- | :--- | :--- |
| Consume Diff（堆积） | 队列最新消息位 − 消费组已消费位 | 持续增长 = 消费跟不上（积压），见 [背压与积压](/fundamentals/backpressure) |
| 重试队列深度 | `%RETRY%<组>` 中待重投的消息 | 增长 = 消费失败率上升 |
| DLQ 深度 | `%DLQ%<组>` 中耗尽重试的消息 | >0 = 有毒消息/逻辑缺陷需人工介入 |
| 发送 TPS / 失败率 | Broker 接收能力 | 失败率升高 = 容量或网络异常 |
| Broker 磁盘 / 保留 | CommitLog 占用 | 逼近磁盘上限前预警（保留期清理） |

补充观测点：

- **端到端延迟**：消息产生到消费的时差，比 Consume Diff 更贴近业务感受（fifo-delay 实验的 `deliveryDelayMs` 即此类）。
- **事务回查次数**：长时间未确认的 Half Message 触发回查，异常升高说明生产者二次确认缺失。

## 消费堆积（Consume Diff）

- Consume Diff = 未消费消息总量，等价于 Kafka 的 lag。
- 堆积上涨先查：消费者是否存活、是否卡在单条毒消息（FIFO 队列会因失败阻塞）、处理速度是否低于生产速度。
- 注意：堆积消息仍占保留期内的日志空间；若保留期先于消费到期，慢消费组会真的错过消息。

## Dashboard 简介

RocketMQ Dashboard（原 rocketmq-console）提供 Web 界面：Topic/消费组管理、消费进度、消息查询（按 Key/时间）、Broker 状态。生产建议部署并限制访问来源；本仓库实验未启用，断言直接用 `mqadmin`。

## 追踪传播

本仓库 Demo 把 `traceId`、`eventType`、`aggregateId` 写入消息属性（properties），消费端日志原样带出；一条消息在 producer/consumer 两端可用同一 traceId 关联。生产可接 OpenTelemetry：producer 注入属性，consumer 从属性恢复 context。

## 常见故障速查

| 现象 | 先查什么 |
| :--- | :--- |
| 消费停滞、Consume Diff 上涨 | 消费者是否存活；FIFO 队列是否被失败消息阻塞 |
| 客户端报路由 40402 | Topic 刚建、Broker 尚未向 NameServer 注册路由（~30s 心跳） |
| 消息「重复」 | ack 早于业务完成？发送端重试未配幂等去重？ |
| 消息「丢失」 | 异步刷盘+异步复制下 Broker 崩溃；保留期是否先于消费删除 |
| 事务消息不投递 | 生产者是否漏了二次确认；回查是否返回 ROLLBACK |

## 安全基线（单节点实验版）

- 本仓库实验不开认证，且仅 Proxy 端口映射到 `127.0.0.1`，NameServer/Broker 不出 Compose 网络——仅限学习用途。
- 生产基线：ACL 鉴权 + TLS、按 Topic/Group 最小授权、管理端口与数据端口分离并限制网络访问。
- 单容器三服务拓扑不等价生产集群；生产应分离角色、规划副本与磁盘（见 [存储与高可用](/brokers/rocketmq/storage-ha)）。

## 官方资料

- RocketMQ 文档首页：<https://rocketmq.apache.org/docs/>（checkedAt: 2026-08-19）
- Topic：<https://rocketmq.apache.org/docs/domainModel/02topic>（checkedAt: 2026-08-19）
