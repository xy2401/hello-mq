# RabbitMQ 运维与观测

> 本页结论：看懂四个核心指标（队列深度、Unacked、消费速率、内存/磁盘告警）就能覆盖大多数 RabbitMQ 日常问题；本仓库 lab 用 `rabbitmqctl` JSON 输出做 Broker 侧断言。

## 管理接口

| 工具 | 用途 |
| :--- | :--- |
| Management UI（15672） | 队列/Exchange/绑定/连接可视化，本仓库实验容器默认开启 |
| `rabbitmqctl` / `rabbitmq-diagnostics` | 节点级命令：状态、队列列表、诊断 |
| Management HTTP API | `/api/queues`、`/api/nodes` 等，供监控采集 |
| Prometheus 插件 | `rabbitmq_prometheus`，指标导出到 9090 端口 |

本仓库 lab 框架在断言阶段调用（示例）：

```bash
docker compose -p <project> exec rabbitmq \
  rabbitmqctl list_queues name messages messages_ready messages_unacknowledged --formatter=json
```

## 核心指标

| 指标 | 含义 | 异常信号 |
| :--- | :--- | :--- |
| `messages_ready` | 队列中等待投递的消息数 | 持续增长 = 消费跟不上（积压），见 [背压与积压](/#mq-backpressure) |
| `messages_unacknowledged` | 已投递未 ACK 的在途消息 | 堆积 = 消费者卡死/处理过慢/忘记 ACK |
| publish/deliver/ack 速率 | 生产与消费吞吐曲线 | deliver 归零而 ready 增长 = 消费者断连 |
| 内存/磁盘 watermark | 节点资源告警线 | 触发后 Broker 流控（blocking producers），全局变慢 |

补充观测点：

- **redeliver 速率**：突增通常意味着消费者崩溃或处理异常（对照 [consumer-crash 实验](/playground/consumer-crash) 的 `redelivered=true` 日志）。
- **连接/Channel 数**：连接泄漏与 Channel 暴涨是常见故障。
- **DLQ 深度**：DLQ 有消息 = 有失败需要人工处理，应直接告警。

## 追踪传播

本仓库 Demo 把 `traceId`、`eventType`、`aggregateId` 写入消息 headers，消费端日志原样带出，一条消息在 producer/consumer 两端可用同一 traceId 关联。生产环境可接 OpenTelemetry：producer 注入 context，consumer 从 headers 恢复。

## 常见故障速查

| 现象 | 先查什么 |
| :--- | :--- |
| 生产端突然变慢/超时 | 节点是否进入 memory/disk alarm（流控）；队列是否积压 |
| 消息「消失」 | 是否发到未绑定的 Exchange（开 mandatory + basicReturn 观察）；是否被 TTL/max-length 淘汰 |
| 消费停滞 | Unacked 是否打满 prefetch；消费者进程是否存活 |
| 重启后消息没了 | 队列/消息是否 durable+persistent；是否用了 Classic 单副本队列 |

## 安全基线（单节点实验版）

- 本仓库实验账号 `guest/guest` 仅允许 localhost 访问（RabbitMQ 默认行为），管理端口只绑 `127.0.0.1`。
- 生产基线：独立用户 + 最小权限（configure/write/read 正则按实体收敛）、TLS 加密 AMQP、禁用默认 guest、审计开启 management 审计日志。
- Kubernetes/Helm 部署只讲原则：单容器实验拓扑不等价生产集群；Quorum Queue 需要节点反亲和与稳定的存储。

## cli-tools：纯自带 CLI 实验

sbin 共 10 项；4.x 已移除 `rabbitmqctl add_queue`（实测 Command not found），队列声明改用 management 镜像自带的 `rabbitmqadmin declare queue`。镜像内没有 curl/python3，收发由宿主机 curl 调 management HTTP API（15672）完成：publish ×3 全部 `"routed":true`，get 以 `ack_requeue_false` 消费即删除 3 条。最后 `rabbitmqctl list_queues` 复查队列深度归零。

<LabOutput product="rabbitmq" lab="docker" />

## 官方资料

- Monitoring：<https://www.rabbitmq.com/docs/monitoring>（checkedAt: 2026-08-19）
- Production Checklist：<https://www.rabbitmq.com/docs/production-checklist>（checkedAt: 2026-08-19）
- Prometheus plugin：<https://www.rabbitmq.com/docs/prometheus>（checkedAt: 2026-08-19）
