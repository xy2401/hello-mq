# Apache Pulsar 快速开始

> 本页结论：最短闭环——启动一个 standalone Pulsar（broker + BookKeeper + ZooKeeper 单容器），向 `persistent://public/default/orders-basic` 发送 3 条订单事件，Exclusive 订阅手动 ack + 幂等落库，断言 produced/received/business_rows=3，然后干净清理。

## 前置条件

- Docker（含 Compose v2）与 JDK 21+、Maven。
- 端口 `6650`（pulsar 协议）与 `8080`（管理/HTTP）仅绑定到 `127.0.0.1`。
- standalone 单容器内嵌三个角色，冷启动要初始化 BookKeeper ledger 与元数据，**通常需要 60–120 秒**；lab 的 healthcheck 上限设为 180 秒，由 compose `service_healthy` 条件等待，而不是固定 sleep。
- 不挂持久卷：每次实验都是全新状态，`down` 时数据随容器销毁。

## 一步运行实验

```bash
bash demos/pulsar/basic/run.sh
```

该命令完成整个闭环：启动 standalone → 等待健康 → Producer 发送 3 条 `OrderCreated.v1` 到 `orders-basic` → Exclusive 订阅在业务事务提交后才 ack + 幂等落库 → 断言（produced=received=business_rows=3）→ 自动停止并删除容器。

## 手工走一遍（理解每一步）

```bash
cd demos/pulsar/basic

# 1. 构建 jar（run.sh 的 ensure_jar 同样只在缺失时执行）
mvn -B -q -f ../../pom.xml -pl pulsar -am package -DskipTests

# 2. 启动完整流程：pulsar → consumer → producer → inspect-db
#    （Exclusive 订阅默认从 Latest 开始，故 consumer 先于 producer 启动；顺序由 depends_on 条件保证）
docker compose --env-file ../../.env.versions up -d
docker compose wait inspect-db

# 3. 观察订阅游标与积压（msgBacklog 应为 0）
docker compose exec pulsar \
  bin/pulsar-admin topics stats persistent://public/default/orders-basic

# 4. 查看各角色日志与退出码
docker compose logs producer
docker compose ps --all

# 5. 清理（仅删除本实验的 Compose Project）
docker compose --env-file ../../.env.versions down --volumes
```

Topic 短名 `orders-basic` 的全限定名是 `persistent://public/default/orders-basic`（standalone 默认 tenant=`public`、namespace=`default`，多租户见 [存储与高可用](/products/pulsar/storage-ha)）。

## 预期输出

每条日志都是统一的 key=value 结构。生产端关键一行（MessageId 形如 `ledger:entry:partition`，示意）：

```text
[producer] ... destination=orders-basic messageId=17:3:-1 seq=1 status=produced
```

消费端关键三行（收到 → 业务提交 → 业务提交后才 ack）：

```text
[consumer] ... subscription=orders-basic-sub messageId=17:3:-1 seq=1 status=received
[consumer] ... messageId=17:3:-1 status=business_committed
[consumer] ... messageId=17:3:-1 status=acked
```

## 与 RabbitMQ / Kafka 快速开始的差异

| 环节 | RabbitMQ | Kafka | Pulsar |
| :--- | :--- | :--- | :--- |
| 拓扑声明 | 声明 durable 队列 | 显式创建 Topic + 分区数 | 非分区 Topic 首次写入自动创建；分区 Topic 需预先创建 |
| 生产确认 | Publisher Confirm | `send().get()` 返回 partition+offset | `send()` 返回 MessageId（ledger:entry），表示已按 quorum 持久化 |
| 消费确认 | 手动 ACK 删除消息 | 手动 `commitSync` 提交 offset | 单条 `acknowledge`（individual）或批量 cumulative ack |
| Broker 侧断言 | 队列深度 | 消费组 lag | 订阅 backlog（`topics stats` 的 msgBacklog） |

## 清理与安全

- run.sh 退出时的 `docker compose down --volumes` 只 down 本实验的 Pulsar Compose Project（`hello-mq-pulsar-basic`）。
- 实验不挂持久卷，也不开认证：仅限 `127.0.0.1` 的学习用途，生产安全基线见 [运维与观测](/products/pulsar/operations)。

## 下一步

- 概念不熟：读 [核心概念映射](/products/pulsar/concepts)。
- 想看四种订阅类型：[订阅与分发](/products/pulsar/routing)（subscriptions 实验）。
- 想看重投、DLQ 与回放：[可靠性](/products/pulsar/reliability)（redelivery-replay 实验）。

## 官方资料

- Standalone 部署：<https://pulsar.apache.org/docs/next/standalone>（checkedAt: 2026-08-19）
- Java Client：<https://pulsar.apache.org/docs/client-libraries/java>（checkedAt: 2026-08-19）
