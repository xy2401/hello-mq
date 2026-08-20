# NATS 快速开始

> 本页结论：最短闭环——启动一个开启 JetStream 的单节点 NATS，先验证 Core NATS 的易失语义，再在 JetStream 上完成「发布 → 持久消费 → 回放」，然后干净清理。

## 前置条件

- Docker（含 Compose v2）与 JDK 21+、Maven。
- 端口 `4222`（客户端）与 `8222`（HTTP 监控）仅绑定到 `127.0.0.1`。

## 一步运行实验

```bash
bash demos/nats/jetstream-replay/run.sh
```

该命令完成整个闭环：启动 NATS（`-js` 启用 JetStream）→ 创建 File 存储的 Stream `ORDERS`（捕获 `orders.events`）→ Producer 用 `JetStream.publish` 发 3 条并等待服务端 PublishAck → 第一个 Durable Consumer 消费并幂等落库 → 第二个 Durable Consumer 从头回放，幂等表拦截 3 条重复 → 断言 Stream 消息数仍为 3 → 自动停止并删除容器。

想看 Core NATS 的对照面：

```bash
bash demos/nats/core-pubsub/run.sh
```

## 手工走一遍（理解每一步）

```bash
cd demos/nats/jetstream-replay

# 1. 启动完整流程：nats → setup → producer → consumer-first → consumer-replay → inspect-db → stats
#    （新 durable 从头回放 ⇒ 回放轮全部 duplicate_skipped；顺序由 depends_on 条件保证）
docker compose --env-file ../../.env.versions up -d
docker compose wait stats

# 2. 观察关键语义：ACK 不删除 Stream 消息
docker compose exec nats nats stream info ORDERS    # Messages => 3

# 3. 查看各角色日志
docker compose logs producer consumer-first consumer-replay

# 4. 清理（仅删除本实验的 Compose Project）
docker compose --env-file ../../.env.versions down --volumes
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

Core NATS 实验中则是 `status=published`——注意它**没有** `confirmed`：Core 层不存在服务端确认。

## 调试入口

```bash
# 实验运行期间，官方 CLI 在镜像内可用（在 demos/nats/jetstream-replay 目录执行）
docker compose exec nats nats stream ls
# HTTP 监控（仅 localhost）
curl http://127.0.0.1:8222/jsz?consumers=1
```

## 清理与安全

- run.sh 退出时的 `docker compose down --volumes` 只 down 本实验的 Compose Project（如 `hello-mq-nats-jetstream-replay`）。
- 实验不挂持久卷：JetStream 的 File 存储随容器销毁，每次实验从干净状态开始。

## 下一步

- 先分清两层语义：读 [核心概念映射](/brokers/nats/concepts)。
- 想看 Core 的「断线窗口」：读 [可靠性](/brokers/nats/reliability) 的易失语义一节。
