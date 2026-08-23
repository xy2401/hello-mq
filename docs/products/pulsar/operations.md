# Apache Pulsar 运维与观测

> 本页结论：看懂三个信号就能覆盖大多数 Pulsar 日常问题——订阅 backlog（积压）、进出速率、bookie 写入健康；日常操作靠 `pulsar-admin`（查 stats/backlog、列订阅、reset-cursor 回放）。本仓库实验仅绑定 `127.0.0.1`，不开认证。

## 管理接口

| 工具 | 用途 |
| :--- | :--- |
| `pulsar-admin` | Topic/订阅/命名空间管理：stats、backlog、reset-cursor、策略配置 |
| `pulsar-client` | 命令行手工 produce/consume 调试 |
| HTTP Admin API | `http://127.0.0.1:8080`，pulsar-admin 的底层 REST 接口 |
| `/metrics` | Broker 的 Prometheus 指标端点（同 8080 端口） |
| `bin/pulsar-admin brokers healthcheck` | 存活自检（compose healthcheck 即用它） |

本仓库 lab 在容器内调用（示例，回放见 redelivery-replay 实验）：

```bash
# 列出订阅
docker compose -p hello-mq-pulsar-basic exec pulsar \
  bin/pulsar-admin topics subscriptions persistent://public/default/orders-basic

# 订阅级状态：cursor 位置、msgBacklog、msgRateOut（JSON）
docker compose -p hello-mq-pulsar-basic exec pulsar \
  bin/pulsar-admin topics stats persistent://public/default/orders-basic

# 只看积压大小
docker compose -p hello-mq-pulsar-basic exec pulsar \
  bin/pulsar-admin topics backlog persistent://public/default/orders-basic

# 重置游标到最早位置（全量回放）；也支持 latest / MessageId / 时间戳
docker compose -p hello-mq-pulsar-redelivery-replay exec pulsar \
  bin/pulsar-admin topics reset-cursor persistent://public/default/orders-redeliver \
  --subscription <sub> --reset-position earliest

# 查看命名空间保留策略
docker compose -p hello-mq-pulsar-basic exec pulsar \
  bin/pulsar-admin namespaces policies public/default
```

## 核心指标

| 指标（Prometheus 示例名） | 含义 | 异常信号 |
| :--- | :--- | :--- |
| `pulsar_msg_backlog`（按订阅） | 该订阅未消费消息数 | 持续增长 = 消费跟不上生产（积压），见 [背压与积压](/#mq-backpressure) |
| `pulsar_rate_in` / `pulsar_rate_out` | Topic 进/出消息速率 | out 骤降而 in 平稳 = 消费侧故障 |
| `pulsar_storage_size` | Topic 占用存储 | 逼近磁盘水位 = 该调 retention/TTL 或扩容 bookie |
| 未 ack 消息数 / 重投速率 | 消费处理健康度 | 重投速率飙升 = 毒消息循环或下游超时 |
| BookKeeper 写入延迟 / 失败 | 存储层健康 | 写延迟抖动 = bookie 磁盘或 quorum 不足 |

补充观测点：

- **reset-cursor 是双刃剑**：回放会把 backlog 瞬间拉满并触发重复投递，执行前确认消费端幂等（[redelivery-replay 实验](/products/pulsar/reliability) 即此场景）。
- **DLQ 深度**：`<topic>-<sub>-DLQ` 有消息 = 有处理失败被隔离，需要告警与处置流程。
- **端到端延迟**：消息 event time 与消费时刻之差，比 backlog 更贴近业务感受。

## 追踪传播

本仓库 Demo 把 `traceId`、`eventType`、`aggregateId` 写入消息 properties，消费端日志原样带出；一条消息在 producer/consumer 两端可用同一 traceId 关联。生产环境可接 OpenTelemetry：producer 注入 properties，consumer 恢复 context。

## 常见故障速查

| 现象 | 先查什么 |
| :--- | :--- |
| backlog 持续上涨 | 消费者是否存活；是否卡在毒消息（无 DeadLetterPolicy 时无限重投） |
| 生产超时/失败 | bookie 写入是否健康；quorum 是否不足；Broker 是否饱和 |
| 消息「重复」 | ack 是否早于业务提交；生产者重试是否重复写入；是否刚执行过 reset-cursor |
| 消息「看不到」 | TTL 是否先于消费删除；订阅 cursor 是否被重置过；是否消费了错误的订阅名 |
| 第二个消费者连不上 | Exclusive 订阅的排他语义：冲突报错是预期行为，换 Shared/Key_Shared |
| standalone 健康检查超时 | 冷启动需 60–120s；确认等待上限 ≥180s 且机器资源够（堆 512m + 直接内存 256m 起） |

## 安全基线（standalone 实验版）

- 本仓库实验不开认证：`6650`（pulsar）与 `8080`（管理）仅绑定 `127.0.0.1`——仅限学习用途。
- 生产基线：TLS 传输加密 + 认证（JWT/OAuth2/客户端证书）、tenant/namespace/topic 层级授权最小化、审计日志；管理 API 与元数据服务端口不暴露公网。
- standalone 单容器（broker+bookie+元数据合一）不等价生产集群：生产应三层分离部署、元数据服务奇数节点、bookie 磁盘与 quorum 独立规划。

## cli-tools：纯自带 CLI 实验

standalone 镜像 bin 目录共 19 项，`pulsar-admin` 与 `pulsar-client` 即可完成收发闭环：`brokers healthcheck` 体检 → `topics create` 建 non-partitioned Topic → `pulsar-client produce -m` 以逗号分隔一次拆成 3 条消息 → `consume -n 3 --subscription-position Earliest` 收满自动退出。最后 `topics stats` 复查 msgInCounter=3、msgBacklog=0，全程不引入任何客户端 SDK。

<LabOutput product="pulsar" lab="docker" />

## 官方资料

- Admin API（Topics）：<https://pulsar.apache.org/docs/next/admin-api-topics>（checkedAt: 2026-08-19）
- Pulsar Metrics：<https://pulsar.apache.org/docs/next/reference-metrics>（checkedAt: 2026-08-19）
- Security Overview：<https://pulsar.apache.org/docs/next/security-overview>（checkedAt: 2026-08-19）
