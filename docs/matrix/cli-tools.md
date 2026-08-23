# 自带 CLI 对照矩阵

> 本页结论：八个产品全部有 Docker/CLI 证据。Kafka、Pulsar、Redis Streams、RocketMQ、Artemis、ActiveMQ Classic 六个产品可用镜像自带入口完成状态、创建、生产、消费和复查；RabbitMQ 的队列与状态操作自带，收发需借道 management HTTP API；NATS 官方镜像是 distroless，只有 `/nats-server`，状态走 8222 监控端点。本页命令与输出摘自 `demos/<产品>/docker/` 真实快照。

版本基线见[矩阵总览](/matrix/)（checkedAt: 2026-08-19）。八组快照采集于 2026-08-20，每组实验的断言全部通过（各 `assert.out.txt` 结果均为 `RESULT: all assertions passed`）。本页只比较「镜像自带命令」这一层，管理插件、Web UI 与指标体系见[运维与观测](/matrix/operations)。

## 核心对照表

「闭环等级」的定义：**完整闭环** = 纯自带命令完成状态 → 建队列 → 生产 → 消费 → 复查；**管理 API 辅助** = 收发需经管理 HTTP API，非独立 CLI 命令；**仅状态** = 自带命令只能看状态，收发是缺口。

| 产品 | bin 规模 | 状态查询 | 建 topic/queue | 生产 | 消费 | 闭环等级 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Kafka | /opt/kafka/bin 43 个 .sh | `kafka-cluster.sh cluster-id` | `kafka-topics.sh --create` | `kafka-console-producer.sh` | `kafka-console-consumer.sh` | 完整闭环 |
| Pulsar | /pulsar/bin 19 项 | `pulsar-admin brokers healthcheck` | `pulsar-admin topics create` | `pulsar-client produce -m`（逗号拆多条） | `pulsar-client consume -n` | 完整闭环 |
| Redis Streams | 6 个二进制（redis-cli 等） | `INFO server` | `XGROUP CREATE ... MKSTREAM` | `XADD` | `XREADGROUP`/`XACK`（首读 `>` 重放 `0`） | 完整闭环 |
| RocketMQ | bin 36 项 | `mqadmin clusterList` | `mqadmin updateTopic` | `mqadmin sendMessage -p body -c tag` | `mqadmin consumeMessage`（默认排空，`-c` 条数上限不可靠） | 完整闭环 |
| Artemis | bin 仅统一入口 `artemis`（+lib） | `artemis check node` | `artemis queue create` | `artemis producer` | `artemis consumer`/`browser` | 完整闭环 |
| ActiveMQ Classic | `/opt/apache-activemq/bin` 入口脚本 | `activemq status` | producer 首次发送自动建立队列 | `activemq producer` | `activemq consumer` | 完整闭环 |
| RabbitMQ | sbin 10 项 | `rabbitmqctl status` | `rabbitmqadmin declare queue`（management 自带；4.x 移除 `rabbitmqctl add_queue`） | 无自带命令，走 management HTTP API | 无自带命令，宿主机 curl publish/get | 管理 API 辅助 |
| NATS | distroless 单一 `/nats-server` | 8222 监控 `/healthz` `/varz` `/connz` `/subsz` | ➖ 无自带 CLI（缺口） | ➖ 无收发 CLI（缺口） | ➖ 无收发 CLI（缺口） | 仅状态 |

两点横向评注：

- bin 规模与闭环能力不成正比：Kafka 43 个脚本、Artemis 单一入口和 ActiveMQ Classic 的统一启动脚本都能完成闭环；NATS 最精简却连收发都做不到（官方 CLI 由 nats-io/natscli 独立发行，不在镜像内）。
- 同一动词含义不同：`consume` 在 Kafka/Pulsar/Artemis 是独立命令，在 Redis Streams 是 `XREADGROUP` + `XACK` 两步，在 RocketMQ 是排空式查看（不推进任何消费组位点），在 RabbitMQ 是 management API 的 `get`（取走即确认）。

## 快照证据摘录

以下输出逐字摘自各实验目录的 `*.out.txt`，路径即证据。

### Kafka（demos/kafka/docker/）

```text
# status.out.txt
Cluster ID: MkU3OEVBNTcwNTJENDM2Qk

# consume.out.txt
order-cli-1
order-cli-2
order-cli-3
Processed a total of 3 messages

# verify.out.txt（消费组复查，LAG=0）
orders-cli-group orders.cli      0          3               3               0
```

`assert.out.txt`：`PASS binCount: 43`、`PASS consumerGroupLag: 0`。

### Pulsar（demos/pulsar/docker/）

```text
# status.out.txt
$ bin/pulsar-admin brokers healthcheck
ok

# produce.out.txt（-m 用逗号拆成 3 条）
PulsarClientTool - 3 messages successfully produced

# consume.out.txt
----- got message -----
publishTime:[1787242491101], eventTime:[0], key:[null], properties:[], content:order-cli-1
```

`verify.out.txt`：`topics stats` 显示 `msgInCounter: 3`，订阅 `msgBacklog: 0`；`assert.out.txt`：`PASS producedMsgCount: 3`、`PASS consumedMsgCount: 3`。

### Redis Streams（demos/redis-streams/docker/）

```text
# bin-list.out.txt
redis-benchmark redis-check-aof redis-check-rdb redis-cli redis-sentinel redis-server
redis-cli 8.2.1

# create.out.txt（建组顺便建 Stream）
$ redis-cli XGROUP CREATE orders:cli orders-cli-group 0 MKSTREAM
OK

# verify.out.txt（XACK 后 PEL 清零）
XLEN=3
PENDING=0
```

`consume.out.txt`：`XREADGROUP ... '>'` 首读 3 条，`XACK` 返回 `3`，再以 `0` 重放为空——「首读 `>`、重放 `0`」是 Redis Streams 消费的两段式语义。

### RocketMQ（demos/rocketmq/docker/）

```text
# status.out.txt
DefaultCluster          hello-mq-broker         0     172.18.0.3:10911       V5_5_0  ...  true

# produce.out.txt（sendMessage -p order-cli-1 -c TagCli）
hello-mq-broker                   7     SEND_OK                 AC12000301F32FF4ACD0655B785E0000

# consume.out.txt（consumeMessage 默认排空全部队列）
MSGID: AC12000301F32FF4ACD0655B785E0000 MessageExt [... TAGS=TagCli ...] BODY: order-cli-1
```

`assert.out.txt`：`PASS binCount: 36`、`PASS consumedUnique: 3`、`PASS maxOffsetSum: 3`。`-c <N>` 不是可靠条数上限：run.sh 注释记录实测——源码对每个访问过的队列都扣减 countLeft，8 队列下 `-c 3` 可能只消费到 1 条，故本实验用默认值排空。

### Artemis（demos/artemis/docker/）

```text
# status.out.txt
Checks run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.085 sec - NodeCheck

# create.out.txt
Queue [name=orders-cli, address=orders-cli, routingType=ANYCAST, durable=true, ...] created successfully.

# verify.out.txt（queue stat：队列已空，3 条全部 acked）
|orders-cli|orders-cli|   0    |   0   |   3    |    0     |   3    |    0    |ANYCAST| false  |
```

bin 目录只有 `artemis`、`artemis.cmd` 与 `lib/`（`bin-list.out.txt`）：所有子命令（check、queue、producer、consumer、browser）走同一入口。`browser.out.txt` 显示消费后浏览结果为 `browsed: 0 messages`，与 `queue stat` 的 MESSAGE COUNT 0 互证。

### RabbitMQ（demos/rabbitmq/docker/）

```text
# create.out.txt（rabbitmqadmin 为 management 插件自带）
$ rabbitmqadmin declare queue name=orders-cli durable=true
queue declared

# produce.out.txt（宿主机 curl → management API publish）
{"routed":true}

# verify.out.txt
name	messages
orders-cli	0
```

`run.sh` 记录了两点实测结论：4.x 的 rabbitmqctl 已无 `add_queue`（报 `Command 'add_queue' not found`），队列声明改用 rabbitmqadmin；镜像内没有 curl 也没有收发命令，publish/get 只能从宿主机打 15672 的 management HTTP API（`consume.out.txt` 的 get 响应含 3 条 payload，`assert.out.txt`：`PASS binCount: 10`、`PASS queueDepth: 0`）。

### NATS（demos/nats/docker/）

```text
# bin-list.out.txt（distroless：无 bin 目录，只有单一二进制）
$ compose exec nats /nats-server --version
nats-server: v2.11.5

# status.out.txt
$ curl -fsS http://127.0.0.1:8222/healthz
{"status":"ok"}

# gap.out.txt（缺口记录：镜像内找不到收发 CLI）
OCI runtime exec failed: exec failed: unable to start container process: exec: "nats": executable file not found in $PATH
```

`varz.out.txt` 给出版本 2.11.5 与 JetStream 配置，`connz.out.txt`/`subsz.out.txt` 给出连接与订阅计数：状态面齐全，收发面为零——收发必须用外部客户端，Java 实验见 `demos/nats/core-pubsub`。

## CLI vs Java 客户端的取舍

CLI 的长项是**快、零依赖、贴近排障现场**：容器起来就能用，不用引依赖、不用写代码，适合部署后冒烟验证、故障时看队列状态、一次性手工补数。但 CLI 止步于「把一条消息打进去/拿出来」，生产链路上的可靠性机制几乎都不在 CLI 层：

| 能力 | CLI 现状 | 谁来实现 |
| :--- | :--- | :--- |
| 事务（跨分区原子写、事务消息） | 无 | SDK：见[投递语义](/matrix/delivery-semantics) |
| 幂等消费 | 无 | 业务代码：见[幂等消费](/reference/patterns/idempotent-consumer) |
| 重试、退避、DLQ 接线 | 无（最多手工搬运） | SDK/框架配置：见[重试与 DLQ](/reference/patterns/retry-and-dlq) |
| 类型化载荷与 Schema 演进 | 只有字符串/字节 | 客户端序列化：见 [Schema 演进](/reference/patterns/schema-evolution) |
| 批量、连接复用、背压、监听器 | 无 | SDK 运行时能力 |

分工结论：**冒烟与排障用 CLI，生产流量走 SDK**。本站各产品分卷的动手实验（如 [RabbitMQ 快速开始](/products/rabbitmq/quick-start)与[实验总览](/playground/)）全部用 Java 客户端实现，与本页的 CLI 实验互为对照。

## 怎么复现

每个实验独立运行，只起停自己的 Compose Project；运行会重新生成本页引用的全部快照：

```bash
bash demos/kafka/docker/run.sh
bash demos/pulsar/docker/run.sh
bash demos/redis-streams/docker/run.sh
bash demos/rocketmq/docker/run.sh
bash demos/artemis/docker/run.sh
bash demos/rabbitmq/docker/run.sh
bash demos/nats/docker/run.sh
bash demos/activemq-classic/docker/run.sh
```

前置条件：本机 Docker（含 Compose 插件）。RabbitMQ 与 NATS 实验的收发/状态探测从宿主机发起（curl 打 127.0.0.1 映射端口），其余六个产品的命令全部在容器内执行。

## 相关页面

- 管理工具、指标与 Schema 生态的完整对照：[运维与观测](/matrix/operations)
- 安全相关 CLI 能力（认证、授权）：[安全](/matrix/security)
- 选型时如何权衡运维形态：[选型指南](/matrix/selection-guide)
