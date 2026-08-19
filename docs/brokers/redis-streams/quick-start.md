# Redis Streams 快速开始

> 本页结论：最短闭环——启动一个开启 AOF 的单节点 Redis，向 Stream 写入 3 条订单事件，Consumer Group 消费并幂等落库，然后干净清理。

## 前置条件

- Docker（含 Compose v2）与 JDK 21+、Maven。
- 端口 `6379` 仅绑定到 `127.0.0.1`。

## 一步运行实验

```bash
npm run lab -- redis-streams basic
```

该命令完成整个闭环：启动 Redis（AOF 开启）→ 创建 Stream `orders.basic` 与 Consumer Group `orders-basic-group`（从 `$` 开始，只接收组建之后的新条目）→ Producer `XADD` 3 条 `OrderCreated.v1` → Consumer `XREADGROUP` 读取、业务落库后 `XACK` → 断言（含 `XLEN` 仍为 3，证明消费不删除条目）→ 自动停止并删除容器。

## 手工走一遍（理解每一步）

```bash
# 1. 启动 Redis（compose 文件锁定镜像 digest；项目名与 lab.js 一致）
docker compose -p hello-mq-redis-streams-basic --env-file .env.versions \
  -f compose/redis-streams.compose.yml up -d

# 2. 等待健康（轮询，而不是固定 sleep；参数为位置参数）
node scripts/wait-for-service.js hello-mq-redis-streams-basic \
  compose/redis-streams.compose.yml redis 90 .env.versions

# 3. 创建组、发送、消费（lab 内部同样调用这些目标）
mvn -B -q -f demos/pom.xml -pl redis-streams -am package -DskipTests
java -jar demos/redis-streams/target/hello-mq-redis-streams.jar setup --lab=basic
java -jar demos/redis-streams/target/hello-mq-redis-streams.jar produce --lab=basic \
  --stream=orders.basic --files=order-1001.json,order-1002.json,order-1003.json
java -jar demos/redis-streams/target/hello-mq-redis-streams.jar consume --lab=basic \
  --stream=orders.basic --group=orders-basic-group --db=.lab/idempotency.db --expected=3

# 4. 观察关键语义：消费完成后条目仍在 Stream，PEL 已清零
docker compose -p hello-mq-redis-streams-basic -f compose/redis-streams.compose.yml \
  exec redis redis-cli XLEN orders.basic          # => 3
docker compose -p hello-mq-redis-streams-basic -f compose/redis-streams.compose.yml \
  exec redis redis-cli XPENDING orders.basic orders-basic-group   # 首列 => 0

# 5. 清理（仅删除本项目的 Compose Project）
npm run lab -- redis-streams clean
```

## 预期输出

每条日志都是统一的 key=value 结构（规格 §12.2），生产端关键一行（`entryId` 是服务端分配的 Entry ID）：

```text
[producer] ... messageId=... destination=orders.basic entryId=... status=confirmed
```

消费端关键两行（先业务提交，后 XACK）：

```text
[consumer] ... messageId=... entryId=... attempt=1 redelivered=false status=received
[consumer] ... messageId=... attempt=1 status=business_committed
```

## 调试入口

容器运行期间可直接用容器内 `redis-cli` 观察：

```bash
docker compose -p hello-mq-redis-streams-basic -f compose/redis-streams.compose.yml \
  exec redis redis-cli XINFO GROUPS orders.basic
```

`XINFO STREAM`/`XINFO GROUPS`/`XINFO CONSUMERS` 的读法见 [运维与观测](/brokers/redis-streams/operations)。

## 清理与安全

- `npm run lab -- redis-streams clean` 只 down 本仓库的 Compose Project（`hello-mq-redis-streams-*`），不会碰其他容器或卷。
- 本仓库的实验 Redis 不挂持久卷：每次实验都是干净状态；AOF 开启只是为了演示落盘语义，生产环境的持久化与复制取舍见 [存储与高可用](/brokers/redis-streams/storage-ha)。

## 下一步

- 概念不熟：读 [核心概念映射](/brokers/redis-streams/concepts)。
- 想看失败路径：运行 `npm run lab -- redis-streams consumer-crash`，观察 PEL 滞留与 XCLAIM 接管。
