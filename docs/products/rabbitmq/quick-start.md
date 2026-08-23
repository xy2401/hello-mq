# RabbitMQ 快速开始

> 本页结论：最短闭环——启动一个单节点 RabbitMQ，发送 3 条订单事件，消费并幂等落库，然后干净清理。

## 前置条件

- Docker（含 Compose v2）与 JDK 21+、Maven。
- 端口 `5672`（AMQP）与 `15672`（管理界面）仅绑定到 `127.0.0.1`。

## 一步运行实验

```bash
bash demos/rabbitmq/basic/run.sh
```

该命令完成整个闭环：启动 Broker → 声明 durable 队列 `orders.basic` → Producer 发送 3 条 `OrderCreated.v1` 并逐条等待 Publisher Confirm → Consumer 手动 ACK + 幂等落库 → 断言 → 自动停止并删除容器。

## 手工走一遍（理解每一步）

```bash
cd demos/rabbitmq/basic

# 1. 构建 jar（run.sh 的 ensure_jar 同样只在缺失时执行）
mvn -B -q -f ../../pom.xml -pl rabbitmq -am package -DskipTests

# 2. 启动完整流程：rabbitmq → setup → producer → consumer → inspect-db
#    （镜像 digest 经 env file 注入；顺序与健康等待由 depends_on 条件保证）
docker compose --env-file ../../.env.versions up

# 3. 观察各角色日志与退出码
docker compose logs producer
docker compose ps --all

# 4. 清理（仅删除本实验的 Compose Project）
docker compose --env-file ../../.env.versions down --volumes
```

## 预期输出

每条日志都是统一的 key=value 结构，生产端关键一行：

```text
[producer] ... messageId=... destination=orders.basic routingKey=orders.basic status=confirmed
```

消费端关键两行（先业务提交，后 ACK）：

```text
[consumer] ... messageId=... attempt=1 redelivered=false status=received
[consumer] ... messageId=... attempt=1 status=business_committed
```

## 管理界面

容器运行期间访问 <http://127.0.0.1:15672>（默认账号 `guest/guest`，仅限 localhost）。可以在 Queues 页面观察 `orders.basic` 的 Ready/Unacked 数量变化。

## 清理与安全

- run.sh 退出时的 `docker compose down --volumes` 只 down 本实验的 Compose Project（`hello-mq-rabbitmq-basic`），不会碰其他容器或卷。
- 本仓库的实验 Broker 不挂持久卷：每次实验都是干净状态，避免脏数据干扰断言；生产环境的存储与高可用见 [存储与高可用](/products/rabbitmq/storage-ha)。

## 下一步

- 概念不熟：读 [核心概念映射](/products/rabbitmq/concepts)。
- 想看失败路径：直接做 [消费者崩溃与重投](/matrix/experiment/consumer-crash) 实验。
