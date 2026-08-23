# Apache Kafka 运维与观测

> 本页结论：看懂四个核心信号（消费组 lag、ISR/under-replicated、磁盘与 retention、端到端延迟）就能覆盖大多数 Kafka 日常问题；本仓库 lab 用 `kafka-consumer-groups.sh` 的 lag 做 Broker 侧断言。

## 管理接口

| 工具 | 用途 |
| :--- | :--- |
| `kafka-topics.sh` | Topic 创建/描述/分区变更 |
| `kafka-consumer-groups.sh` | 消费组列表、位点与 **lag**、位点重置 |
| `kafka-console-consumer.sh` / `kafka-console-producer.sh` | 手工收发调试 |
| `kafka-dump-log.sh` | 直接读段文件排障 |
| JMX 端口 | Broker/Producer/Consumer 指标导出（Prometheus 经 JMX Exporter） |

本仓库 lab 框架在断言阶段调用（示例）：

```bash
docker compose -p <project> exec kafka \
  /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group orders-basic-group
```

## 核心指标

| 指标 | 含义 | 异常信号 |
| :--- | :--- | :--- |
| Consumer Group Lag | 分区最新 offset − 已提交 offset | 持续增长 = 消费跟不上（积压），见 [背压与积压](/#mq-backpressure) |
| UnderReplicatedPartitions | Follower 落后、不在 ISR 的分区数 | >0 表示副本同步异常，可用性在退化 |
| ActiveControllerCount / ISR 收缩速率 | 元数据与副本健康 | Leader 频繁切换、ISR 频繁抖动 = 节点/网络不稳 |
| RequestHandler/Network 空闲率 | Broker 处理能力 | 接近 0 = Broker 饱和 |
| 磁盘使用 / log size | retention 占用 | 达到 retention.bytes 前预警；`retention.ms` 到期删除可能让慢消费组错过消息 |

补充观测点：

- **rebalance 次数与耗时**：频繁再均衡 = 消费者不稳定（超时配置、GC、处理过慢）。
- **端到端延迟**：record timestamp 与消费时刻之差，比 lag 更贴近业务感受。
- **Producer 端**：record-error-rate、重试次数；幂等 producer 的重复序列错误是重要信号。

## 追踪传播

本仓库 Demo 把 `traceId`、`eventType`、`aggregateId` 写入 record headers，消费端日志原样带出；一条消息在 producer/consumer 两端可用同一 traceId 关联。生产环境可接 OpenTelemetry：producer 注入 headers，consumer 从 headers 恢复 context。

## 常见故障速查

| 现象 | 先查什么 |
| :--- | :--- |
| 消费停滞、lag 上涨 | 消费者进程是否存活；是否卡在单条毒消息（无内置重试，会一直重读或阻塞） |
| 生产变慢/超时 | Broker 是否饱和；`min.insync.replicas` 不满足导致 NotEnoughReplicas |
| 消息「重复」 | offset 提交早于业务完成？Producer 重试时是否未开幂等？ |
| 消息「丢失」 | 是否 acks=0/1 + Leader 崩溃；retention 是否先于消费删除；消费组是否重置过位点 |
| 重启后顺序变了 | 多分区 + 无 key；或消费端多线程拆分了分区处理 |

## 安全基线（单节点实验版）

- 本仓库实验 Broker 不开认证（PLAINTEXT），端口只绑 `127.0.0.1`——仅限学习用途。
- 生产基线：SASL + TLS（或 mTLS）、按 Topic/Group 的 ACL 最小授权、审计日志；controller quorum 节点独立且奇数。
- 单容器 KRaft 合一拓扑不等价生产集群；生产应分离 broker/controller 角色并规划磁盘与网络。

## cli-tools：纯自带 CLI 实验

镜像 `/opt/kafka/bin` 自带全部 43 个 `.sh` 工具，纯靠它们即可完成收发闭环：`kafka-cluster.sh` 查集群状态 → `kafka-topics.sh` 建 `orders.cli` → `kafka-console-producer.sh` 管道灌入 3 条 → `kafka-console-consumer.sh` 以 `--from-beginning --max-messages 3` 收满退出。最后 `kafka-consumer-groups.sh` 复查 endOffset=3、lag=0，全程不引入任何客户端 SDK。

<LabOutput product="kafka" lab="docker" />

## 官方资料

- Monitoring（JMX 指标）：<https://kafka.apache.org/documentation/#monitoring>（checkedAt: 2026-08-19）
- Consumer Group Command：<https://kafka.apache.org/documentation/#basic_ops_consumer_group>（checkedAt: 2026-08-19）
- Security：<https://kafka.apache.org/documentation/#security>（checkedAt: 2026-08-19）
