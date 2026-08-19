# Apache RocketMQ 快速开始

> 本页结论：最短闭环——启动 namesrv/broker/proxy 三节点，建一个 Normal Topic，发送 3 条订单事件，SimpleConsumer 拉取、业务事务提交后才 ack 并幂等落库，Consume Diff 归零，然后干净清理。

## 前置条件

- Docker（含 Compose v2）与 JDK 21+、Maven。
- 仅 Proxy 端口 `8081` 映射到 `127.0.0.1`；NameServer（9876）与 Broker 只在 Compose 网络内可见。
- 本仓库 `broker.conf` 关闭了 `autoCreateTopicEnable` 与 `autoCreateSubscriptionGroup`：Topic 与消费组一律经 broker 容器内的 `mqadmin` 显式创建。
- Topic 命名不允许点号：5.x 客户端校验 `^[%|a-zA-Z0-9_-]+$`，故本仓库用 `orders-basic`、`orders-fifo`、`orders-txn`、`orders-retry`（而非 Kafka 风格的 `orders.basic`）。

## 一步运行实验

```bash
npm run lab -- rocketmq basic
```

该命令完成整个闭环：启动 namesrv/broker/proxy → `mqadmin` 建 Normal Topic `orders-basic` 与消费组 `orders-basic-group` → Producer 经 proxy 发 3 条 `OrderCreated.v1` → SimpleConsumer 拉取、业务事务提交后才 ack 并幂等落库 → 断言（含 Consume Diff=0）→ 自动停止并删除容器。

## 手工走一遍（理解每一步）

```bash
# 1. 启动三服务（compose 文件锁定镜像 digest；项目名与 lab.js 一致）
docker compose -p hello-mq-rocketmq-basic --env-file .env.versions \
  -f compose/rocketmq.compose.yml up -d

# 2. 等待 proxy 健康（轮询，而不是固定 sleep）
node scripts/wait-for-service.js hello-mq-rocketmq-basic \
  compose/rocketmq.compose.yml proxy 120 .env.versions

# 3. 建 Topic 与消费组（broker 容器内 mqadmin；Topic 需声明 message.type）
docker compose -p hello-mq-rocketmq-basic exec broker \
  sh mqadmin -n namesrv:9876 updateTopic -c DefaultCluster \
  -t orders-basic -r 4 -w 4 -a "+message.type=NORMAL"
docker compose -p hello-mq-rocketmq-basic exec broker \
  sh mqadmin -n namesrv:9876 updateSubGroup -c DefaultCluster -g orders-basic-group

# 4. 构建并发送、消费（lab 内部同样调用这些目标）
mvn -B -q -f demos/pom.xml -pl rocketmq -am package -DskipTests
java -jar demos/rocketmq/target/hello-mq-rocketmq.jar produce --lab=basic \
  --topic=orders-basic --files=order-1001.json,order-1002.json,order-1003.json
java -jar demos/rocketmq/target/hello-mq-rocketmq.jar consume --lab=basic \
  --topic=orders-basic --group=orders-basic-group \
  --db=.lab/rocketmq/basic/idempotency.db --expected=3

# 5. 观察消费进度（Consume Diff Total 应为 0）
docker compose -p hello-mq-rocketmq-basic exec broker \
  sh mqadmin -n namesrv:9876 consumerProgress -g orders-basic-group

# 6. 清理（仅删除本产品的 Compose Project）
npm run lab -- rocketmq clean
```

## 预期输出

每条日志都是统一的 key=value 结构（规格 §12.2）。生产端关键一行（brokerMessageId 可见）：

```text
[producer] ... destination=orders-basic seq=1 status=produced
```

消费端关键两行（拉取 → 业务提交 → 之后才 ack）：

```text
[consumer] ... messageId=... consumerGroup=orders-basic-group attempt=1 status=received
[consumer] ... messageId=... status=business_committed
```

<LabOutput product="rocketmq" lab="basic" />

## 与 Kafka 快速开始的差异

| 环节 | Kafka | RocketMQ |
| :--- | :--- | :--- |
| 拓扑声明 | 建 Topic + 分区数 | `updateTopic` 建 Topic（带 `message.type`）+ `updateSubGroup` 建组 |
| 接入方式 | 直连 Broker 9092 | 经 Proxy（gRPC，`127.0.0.1:8081`） |
| 消费确认 | 手动 `commitSync` 提交 offset | SimpleConsumer 处理完逐条 `ack` |
| Broker 侧断言 | 消费组 lag | `consumerProgress` 的 Consume Diff |

## 清理与安全

- `npm run lab -- rocketmq clean` 只 down 本仓库的 RocketMQ Compose Project（`hello-mq-rocketmq-*`）。
- 实验不挂持久卷：每次都是干净状态（见 compose 内注释）；生产存储与保留见 [存储与高可用](/brokers/rocketmq/storage-ha)。

## 下一步

- 概念不熟：读 [核心概念映射](/brokers/rocketmq/concepts)。
- 想看顺序与延迟：[路由与分发](/brokers/rocketmq/routing) 的 fifo-delay 实验。

## 官方资料

- RocketMQ 文档首页：<https://rocketmq.apache.org/docs/>（checkedAt: 2026-08-19）
- Topic：<https://rocketmq.apache.org/docs/domainModel/02topic>（checkedAt: 2026-08-19）
