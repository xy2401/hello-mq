# Redis Streams 快速开始

> 本页结论：最短闭环——启动一个开启 AOF 的单节点 Redis，向 Stream 写入 3 条订单事件，Consumer Group 消费并幂等落库，然后干净清理。

## 前置条件

- Docker（含 Compose v2）与 JDK 21+、Maven。
- 端口 `6379` 仅绑定到 `127.0.0.1`。

## 一步运行实验

```bash
bash demos/redis-streams/basic/run.sh
```

该命令完成整个闭环：启动 Redis（AOF 开启）→ 创建 Stream `orders.basic` 与 Consumer Group `orders-basic-group`（从 `$` 开始，只接收组建之后的新条目）→ Producer `XADD` 3 条 `OrderCreated.v1` → Consumer `XREADGROUP` 读取、业务落库后 `XACK` → 断言（含 `XLEN` 仍为 3，证明消费不删除条目）→ 自动停止并删除容器。

## 手工走一遍（理解每一步）

```bash
cd demos/redis-streams/basic

# 1. 启动完整流程：redis → setup → producer → consumer → inspect-db
docker compose --env-file ../../.env.versions up -d
docker compose wait inspect-db

# 2. 观察关键语义：消费完成后条目仍在 Stream，PEL 已清零
docker compose exec redis redis-cli XLEN orders.basic          # => 3
docker compose exec redis redis-cli XPENDING orders.basic orders-basic-group   # 首列 => 0

# 3. 查看各角色日志与退出码
docker compose logs producer consumer
docker compose ps --all

# 4. 清理（仅删除本实验的 Compose Project）
docker compose --env-file ../../.env.versions down --volumes
```

## 预期输出

每条日志都是统一的 key=value 结构，生产端关键一行（`entryId` 是服务端分配的 Entry ID）：

```text
[producer] ... messageId=... destination=orders.basic entryId=... status=confirmed
```

消费端关键两行（先业务提交，后 XACK）：

```text
[consumer] ... messageId=... entryId=... attempt=1 redelivered=false status=received
[consumer] ... messageId=... attempt=1 status=business_committed
```

## 调试入口

容器运行期间可直接用容器内 `redis-cli` 观察（在 demos/redis-streams/basic 目录执行）：

```bash
docker compose exec redis redis-cli XINFO GROUPS orders.basic
```

`XINFO STREAM`/`XINFO GROUPS`/`XINFO CONSUMERS` 的读法见 [运维与观测](/brokers/redis-streams/operations)。

## 清理与安全

- run.sh 退出时的 `docker compose down --volumes` 只 down 本实验的 Compose Project（`hello-mq-redis-streams-basic`），不会碰其他容器或卷。
- 本仓库的实验 Redis 不挂持久卷：每次实验都是干净状态；AOF 开启只是为了演示落盘语义，生产环境的持久化与复制取舍见 [存储与高可用](/brokers/redis-streams/storage-ha)。

## 下一步

- 概念不熟：读 [核心概念映射](/brokers/redis-streams/concepts)。
- 想看失败路径：运行 `bash demos/redis-streams/consumer-crash/run.sh`，观察 PEL 滞留与 XCLAIM 接管。
