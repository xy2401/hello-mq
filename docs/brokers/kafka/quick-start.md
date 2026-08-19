# Apache Kafka 快速开始

> 本页结论：最短闭环——启动一个 KRaft 单节点 Kafka，发送 3 条订单事件到 3 分区 Topic，消费组消费并幂等落库，消费组 lag 归零，然后干净清理。

## 前置条件

- Docker（含 Compose v2）与 JDK 21+、Maven。
- 端口 `9092`（PLAINTEXT）仅绑定到 `127.0.0.1`。
- 本仓库使用 KRaft 单进程模式（broker+controller 合一），不需要 ZooKeeper；`CLUSTER_ID` 与 `auto.create.topics.enable=false` 已在 compose 中固定。

## 一步运行实验

```bash
npm run lab -- kafka basic
```

该命令完成整个闭环：启动 Broker → 创建 3 分区 Topic `orders.basic` → Producer 以 `acks=all` + 幂等生产发送 3 条 `OrderCreated.v1` → 消费组手动提交 offset + 幂等落库 → 断言（含消费组 lag=0）→ 自动停止并删除容器。

## 手工走一遍（理解每一步）

```bash
# 1. 启动 Broker（compose 文件锁定镜像 digest；项目名与 lab.js 一致）
docker compose -p hello-mq-kafka-basic --env-file .env.versions \
  -f compose/kafka.compose.yml up -d

# 2. 等待健康（轮询，而不是固定 sleep；参数为位置参数）
node scripts/wait-for-service.js hello-mq-kafka-basic \
  compose/kafka.compose.yml kafka 90 .env.versions

# 3. 建 Topic、发送、消费（lab 内部同样调用这些目标）
mvn -B -q -f demos/pom.xml -pl kafka -am package -DskipTests
java -jar demos/kafka/target/hello-mq-kafka.jar setup --lab=basic
java -jar demos/kafka/target/hello-mq-kafka.jar produce --lab=basic \
  --topic=orders.basic --files=order-1001.json,order-1002.json,order-1003.json
java -jar demos/kafka/target/hello-mq-kafka.jar consume --lab=basic \
  --topic=orders.basic --group=orders-basic-group --db=.lab/kafka/basic/idempotency.db --expected=3

# 4. 观察消费组位点（lag 应为 0）
docker compose -p hello-mq-kafka-basic exec kafka \
  /opt/kafka/bin/kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --describe --group orders-basic-group

# 5. 清理（仅删除本项目的 Compose Project）
npm run lab -- kafka clean
```

## 预期输出

每条日志都是统一的 key=value 结构（规格 §12.2）。生产端关键一行（分区与 offset 可见）：

```text
[producer] ... destination=orders.basic partitionOrQueue=0 offset=0 seq=1 status=produced
```

消费端关键三行（分配 → 业务提交 → 手动提交 offset 由框架在业务提交后执行）：

```text
[consumer] ... partitions=0,1,2 status=assigned
[consumer] ... messageId=... partitionOrQueue=0 offset=0 seq=1 status=received
[consumer] ... messageId=... status=business_committed
```

## 与 RabbitMQ 快速开始的差异

| 环节 | RabbitMQ | Kafka |
| :--- | :--- | :--- |
| 拓扑声明 | 声明 durable 队列 | 创建 Topic + 分区数（分区数决定并行度上限） |
| 生产确认 | Publisher Confirm | `send().get()` 返回 metadata（partition+offset） |
| 消费确认 | 手动 ACK 删除消息 | 手动 `commitSync` 提交 offset，日志不删除 |
| Broker 侧断言 | 队列深度 | 消费组 lag |

## 清理与安全

- `npm run lab -- kafka clean` 只 down 本仓库的 Kafka Compose Project（`hello-mq-kafka-*`）。
- 实验 Broker 不挂持久卷：每次实验都是干净状态，日志目录在容器内临时路径；生产存储见 [存储与高可用](/brokers/kafka/storage-ha)。

## 下一步

- 概念不熟：读 [核心概念映射](/brokers/kafka/concepts)。
- 想看顺序与回放：[顺序、消费组与回放实验](/labs/ordering)。
