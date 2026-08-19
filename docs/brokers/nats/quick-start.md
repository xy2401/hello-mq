# NATS 快速开始

> 本页结论：最短闭环——启动一个开启 JetStream 的单节点 NATS，先验证 Core NATS 的易失语义，再在 JetStream 上完成「发布 → 持久消费 → 回放」，然后干净清理。

## 前置条件

- Docker（含 Compose v2）与 JDK 21+、Maven。
- 端口 `4222`（客户端）与 `8222`（HTTP 监控）仅绑定到 `127.0.0.1`。

## 一步运行实验

```bash
npm run lab -- nats jetstream-replay
```

该命令完成整个闭环：启动 NATS（`-js` 启用 JetStream）→ 创建 File 存储的 Stream `ORDERS`（捕获 `orders.events`）→ Producer 用 `JetStream.publish` 发 3 条并等待服务端 PublishAck → 第一个 Durable Consumer 消费并幂等落库 → 第二个 Durable Consumer 从头回放，幂等表拦截 3 条重复 → 断言 Stream 消息数仍为 3 → 自动停止并删除容器。

想看 Core NATS 的对照面：

```bash
npm run lab -- nats core-pubsub
```

## 手工走一遍（理解每一步）

```bash
# 1. 启动 NATS（compose 文件锁定镜像 digest；项目名与 lab.js 一致）
docker compose -p hello-mq-nats-jetstream-replay --env-file .env.versions \
  -f compose/nats.compose.yml up -d

# 2. 等待健康（轮询监控端口 /healthz，而不是固定 sleep）
node scripts/wait-for-service.js hello-mq-nats-jetstream-replay \
  compose/nats.compose.yml nats 90 .env.versions

# 3. 建 Stream、发送、消费、回放
mvn -B -q -f demos/pom.xml -pl nats -am package -DskipTests
java -jar demos/nats/target/hello-mq-nats.jar setup --lab=jetstream-replay
java -jar demos/nats/target/hello-mq-nats.jar produce --lab=jetstream-replay \
  --mode=jetstream --subject=orders.events \
  --files=order-1001.json,order-1002.json,order-1003.json
java -jar demos/nats/target/hello-mq-nats.jar consume --lab=jetstream-replay \
  --mode=jetstream --subject=orders.events --durable=orders-first \
  --db=.lab/idempotency.db --expected=3
java -jar demos/nats/target/hello-mq-nats.jar consume --lab=jetstream-replay \
  --mode=jetstream --subject=orders.events --durable=orders-replay \
  --db=.lab/idempotency.db --expected=3   # 新 durable ⇒ 从头回放 ⇒ 全部 duplicate_skipped

# 4. 观察关键语义：ACK 不删除 Stream 消息
docker compose -p hello-mq-nats-jetstream-replay -f compose/nats.compose.yml \
  exec nats nats stream info ORDERS    # Messages => 3

# 5. 清理（仅删除本项目的 Compose Project）
npm run lab -- nats clean
```

## 预期输出

生产端关键一行（`seqno` 是 Stream 内序列号，来自服务端 PublishAck）：

```text
[producer] ... messageId=... destination=orders.events seqno=1 status=confirmed
```

消费端（第一轮全部 business_committed，回放轮全部 duplicate_skipped）：

```text
[consumer] ... messageId=... consumer=orders-first attempt=1 redelivered=false status=received
[consumer] ... messageId=... status=business_committed
[consumer] ... messageId=... consumer=orders-replay status=duplicate_skipped
```

Core NATS 实验中则是 `status=published`——注意它**没有** `confirmed`：Core 层不存在服务端确认（规格 §7.6 禁止混写）。

## 调试入口

```bash
# 官方 CLI 在镜像内可用
docker compose -p hello-mq-nats-jetstream-replay -f compose/nats.compose.yml \
  exec nats nats stream ls
# HTTP 监控（仅 localhost）
curl http://127.0.0.1:8222/jsz?consumers=1
```

## 清理与安全

- `npm run lab -- nats clean` 只 down 本仓库的 Compose Project（`hello-mq-nats-*`）。
- 实验不挂持久卷：JetStream 的 File 存储随容器销毁，每次实验从干净状态开始。

## 下一步

- 先分清两层语义：读 [核心概念映射](/brokers/nats/concepts)。
- 想看 Core 的「断线窗口」：读 [可靠性](/brokers/nats/reliability) 的易失语义一节。
