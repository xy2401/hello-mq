# RabbitMQ 快速开始

> 本页结论：最短闭环——启动一个单节点 RabbitMQ，发送 3 条订单事件，消费并幂等落库，然后干净清理。

## 前置条件

- Docker（含 Compose v2）与 JDK 21+、Maven。
- 端口 `5672`（AMQP）与 `15672`（管理界面）仅绑定到 `127.0.0.1`。

## 一步运行实验

```bash
npm run lab -- rabbitmq basic
```

该命令完成整个闭环：启动 Broker → 声明 durable 队列 `orders.basic` → Producer 发送 3 条 `OrderCreated.v1` 并逐条等待 Publisher Confirm → Consumer 手动 ACK + 幂等落库 → 断言 → 自动停止并删除容器。

## 手工走一遍（理解每一步）

```bash
# 1. 启动 Broker（compose 文件锁定镜像 digest；项目名与 lab.js 一致）
docker compose -p hello-mq-rabbitmq-basic --env-file .env.versions \
  -f compose/rabbitmq.compose.yml up -d

# 2. 等待健康（轮询，而不是固定 sleep；参数为位置参数）
node scripts/wait-for-service.js hello-mq-rabbitmq-basic \
  compose/rabbitmq.compose.yml rabbitmq 90 .env.versions

# 3. 声明队列、发送、消费（lab 内部同样调用这些目标）
mvn -B -q -f demos/pom.xml -pl rabbitmq -am package -DskipTests
java -jar demos/rabbitmq/target/hello-mq-rabbitmq.jar setup --lab=basic
java -jar demos/rabbitmq/target/hello-mq-rabbitmq.jar produce --lab=basic \
  --queue=orders.basic --files=order-1001.json,order-1002.json,order-1003.json
java -jar demos/rabbitmq/target/hello-mq-rabbitmq.jar consume --lab=basic \
  --queue=orders.basic --db=.lab/idempotency.db --expected=3

# 4. 清理（仅删除本项目的 Compose Project）
npm run lab -- rabbitmq clean
```

## 预期输出

每条日志都是统一的 key=value 结构（规格 §12.2），生产端关键一行：

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

- `npm run lab -- rabbitmq clean` 只 down 本仓库的 Compose Project（`hello-mq-rabbitmq-*`），不会碰其他容器或卷。
- 本仓库的实验 Broker 不挂持久卷：每次实验都是干净状态，避免脏数据干扰断言；生产环境的存储与高可用见 [存储与高可用](/brokers/rabbitmq/storage-ha)。

## 下一步

- 概念不熟：读 [核心概念映射](/brokers/rabbitmq/concepts)。
- 想看失败路径：直接做 [消费者崩溃与重投](/labs/consumer-crash) 实验。
