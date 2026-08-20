# Redis Streams 运维与观测

> 本页结论：Redis Streams 的可观测性建立在 `XINFO`、`XPENDING` 与 `INFO` 之上；积压看「组位点与 Stream 末尾的距离」，故障接管看 PEL 空闲时长，容量看内存与裁剪策略。

## 核心诊断命令

| 目的 | 命令 | 读什么 |
| :--- | :--- | :--- |
| Stream 概况 | `XINFO STREAM <key>` | length、last-generated-id、first/last entry、radix 节点数 |
| 组与积压 | `XINFO GROUPS <key>` | 每组的 last-delivered-id、entries-read、lag、PEL count |
| 消费者明细 | `XINFO CONSUMERS <key> <group>` | 每个消费者的 pending 数、idle 时长 |
| 未确认清单 | `XPENDING <key> <group>` / `... - + N` | 总数、ID 范围、归属消费者、投递次数 |
| 内存占用 | `MEMORY USAGE <key>` | 单 Stream 的实际内存 |
| 实例状态 | `INFO memory` / `INFO persistence` | used_memory、AOF 延迟、rdb 状态 |

## 积压定位决策树

```text
XINFO GROUPS 的 lag / PEL count 上升
├── lag 涨、PEL 平：消费速度跟不上生产
│   └── 加组内消费者 / 优化单条处理；注意无分区，单组并行受条目分发限制
├── PEL 涨、lag 平：读得多、ACK 得少
│   └── 检查消费者是否在 XACK 前做长事务；检查业务失败后是否从不 ACK
├── PEL 里 idle 很大、consumer 不活跃：消费者死了没接管
│   └── 部署 XAUTOCLAIM 巡检任务（min-idle 建议 > 最长处理时长）
└── used_memory 逼近 maxmemory：条目无裁剪
    └── 补 XTRIM MAXLEN/MINID；确认没有慢组依赖已被裁剪的历史
```

## 关键指标映射

| 指标类别 | Redis Streams 对应 |
| :--- | :--- |
| Backlog | `XINFO GROUPS` 的 lag 与 pel-count |
| Consumer | `XINFO CONSUMERS` 的 pending、idle |
| DLQ 等价物 | 自建 DLQ Stream 的 `XLEN`、最老条目 Entry ID 年龄 |
| Broker | `INFO` 的 connected_clients、used_memory、aof_last_write_status |
| Business | 幂等表 duplicate_skipped 计数（应用侧埋点） |

## 安全基线

- 默认无认证：生产必须配置 ACL 用户 + 密码，按 key 模式授权（如 `~orders.*` 只给订单服务）。
- `6379` 不暴露公网；本仓库 compose 只绑 `127.0.0.1`。
- TLS：`redis-server` 支持 TLS 监听；客户端证书可选（双向 TLS）。
- 危险命令面：`FLUSHALL/KEYS/XGROUP DESTROY` 等用 ACL 限制给运维角色。

## 管理操作速查

```bash
# 重置组位点（回放/跳过；$ = 末尾，0 = 从头，也可给具体 Entry ID）
redis-cli XGROUP SETID orders.events my-group \$

# 删除死亡消费者的 PEL 归属（条目仍需先 XCLAIM/ACK 处理）
redis-cli XGROUP DELCONSUMER orders.events my-group dead-worker

# 裁剪到最近 10 万条（~ 允许近似裁剪，性能更好）
redis-cli XTRIM orders.events MAXLEN ~ 100000
```

## 常见故障

| 现象 | 常见原因 | 处置 |
| :--- | :--- | :--- |
| PEL 持续膨胀 | 消费者崩溃无接管；业务永远失败又不 ACK | XAUTOCLAIM 巡检 + 死信 Stream |
| 内存告警 | 无裁剪策略 | MAXLEN/MINID + 评估各组回放需求 |
| 切换后少量消息「消失」 | 异步复制丢失窗口 | WAIT 要求 + 上游对账补偿 |
| 慢组读不到老数据 | 激进 XTRIM 删掉了未消费条目 | 裁剪阈值覆盖最慢组的积压上限 |
