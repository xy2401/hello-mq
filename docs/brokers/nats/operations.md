# NATS 运维与观测

> 本页结论：NATS 的可观测性入口是 HTTP 监控端点（`/varz`、`/connz`、`/jsz`、`/healthz`）与官方 CLI（`nats`）；JetStream 的积压看 Consumer 的 pending/ack_pending，容量看 Stream 存储与账户配额。

## 监控端点（`-m 8222` 开启）

| 端点 | 内容 |
| :--- | :--- |
| `/healthz` | 就绪检查（本仓库 compose healthcheck 使用） |
| `/varz` | 服务器全局：连接数、入/出消息速率、内存、slow consumers |
| `/connz` | 连接明细：每个客户端的订阅数、缓冲、收发计数 |
| `/subsz` | 订阅明细 |
| `/jsz?consumers=1` | JetStream：Stream/Consumer 状态、存储占用、副本信息 |
| `/accountz` | 账户与配额（多租户部署时） |

本仓库 compose 已将 `8222` 仅绑定 `127.0.0.1`。

## 官方 CLI 速查

```bash
nats stream ls                          # Stream 列表与消息数
nats stream info ORDERS                 # 消息数、字节数、首末序列
nats consumer ls ORDERS                 # Consumer 列表
nats consumer info ORDERS orders-first  # 位点、pending、ack_pending、重投统计
nats stream get ORDERS 3 --raw          # 按序列号读取单条（回放排查）
nats pub orders.events '...'            # 手工发布
nats sub 'orders.>'                     # 手工订阅（Core 层）
```

## 积压定位决策树

```text
消费延迟增大
├── Core 层：/varz slow_consumers 增长
│   └── 订阅者处理不过来被断开 ⇒ 加 Queue Group 成员 / 迁移到 JetStream
├── JetStream：consumer info 的 Num Pending 持续增长
│   ├── ack_pending 高：投递了没确认
│   │   └── AckWait 太短导致重复重投，或业务处理变慢
│   └── ack_pending 低：生产速率 > 消费速率
│       └── 增加共享该 Consumer 的客户端数；评估 Stream 吞吐上限
└── /jsz 存储接近账户 max_bytes
    └── 调整保留策略/限额，或扩容存储
```

## 关键指标映射

| 指标类别 | NATS 对应 |
| :--- | :--- |
| Producer | PublishAck 延迟与错误率（客户端埋点）；`/varz` in_msgs 速率 |
| Broker | `/varz`：connections、in/out_msgs、mem；`/jsz`：storage、reserved |
| Consumer | `consumer info`：delivered、ack_pending、num_redelivered |
| Backlog | Consumer 的 num_pending（未投递）+ ack_pending（未确认） |
| DLQ 等价物 | 自建 DLQ Stream 的消息数与最老序列年龄 |
| Business | 幂等表 duplicate_skipped 计数（应用侧埋点） |

## 安全基线

- 认证：用户名密码（开发）、Token、**NKey/签名挑战**（推荐）、JWT（多租户运营）。
- 授权：按用户限制可发布/订阅的 Subject 集合；Account 层做租户隔离与导入导出。
- TLS：客户端-服务器与路由（cluster）链路均可启用；生产默认开启。
- 本仓库实验未开启认证（localhost 单节点）；默认开放连接是开发配置，不是生产配置。

## 常见故障

| 现象 | 常见原因 | 处置 |
| :--- | :--- | :--- |
| 发布报 no space left | 账户/Stream 存储配额满 | 调整 max_bytes、清理或扩容 |
| 消息反复重投 | AckWait < 业务处理时长 | 调大 AckWait 或拆小批处理 |
| 副本长时间降级 | R3 节点失联/磁盘慢 | 检查节点健康与磁盘 IO；必要时 stream restore |
| 客户端频繁重连 | 网络抖动或服务器过载 | 检查 /varz 负载与客户端重连缓冲配置 |
