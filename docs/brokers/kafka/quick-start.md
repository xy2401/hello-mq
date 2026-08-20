# Apache Kafka 快速开始

> 本页结论：最短闭环——启动一个 KRaft 单节点 Kafka，发送 3 条订单事件到 3 分区 Topic，消费组消费并幂等落库，消费组 lag 归零，然后干净清理。

## 前置条件

- Docker（含 Compose v2）与 JDK 21+、Maven。
- 端口 `9092`（PLAINTEXT）仅绑定到 `127.0.0.1`。
- 本仓库使用 KRaft 单进程模式（broker+controller 合一），不需要 ZooKeeper；`CLUSTER_ID` 与 `auto.create.topics.enable=false` 已在 compose 中固定。

## 一步运行实验

```bash
bash demos/kafka/basic/run.sh
```

该命令完成整个闭环：启动 Broker → 创建 3 分区 Topic `orders.basic` → Producer 以 `acks=all` + 幂等生产发送 3 条 `OrderCreated.v1` → 消费组手动提交 offset + 幂等落库 → 断言（含消费组 lag=0）→ 自动停止并删除容器。

## 手工走一遍（理解每一步）

```bash
cd demos/kafka/basic

# 1. 构建 jar（run.sh 的 ensure_jar 同样只在缺失时执行）
mvn -B -q -f ../../pom.xml -pl kafka -am package -DskipTests

# 2. 启动完整流程：kafka → setup → producer → consumer → inspect-db
#    （镜像 digest 经 env file 注入；顺序与健康等待由 depends_on 条件保证）
docker compose --env-file ../../.env.versions up -d
docker compose wait inspect-db

# 3. 观察消费组位点（lag 应为 0）
docker compose exec kafka /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 --describe --group orders-basic-group

# 4. 查看各角色日志与退出码
docker compose logs producer
docker compose ps --all

# 5. 清理（仅删除本实验的 Compose Project）
docker compose --env-file ../../.env.versions down --volumes
```

## 预期输出

每条日志都是统一的 key=value 结构。生产端关键一行（分区与 offset 可见）：

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

- run.sh 退出时的 `docker compose down --volumes` 只 down 本实验的 Kafka Compose Project（`hello-mq-kafka-basic`）。
- 实验 Broker 不挂持久卷：每次实验都是干净状态，日志目录在容器内临时路径；生产存储见 [存储与高可用](/brokers/kafka/storage-ha)。

## 下一步

- 概念不熟：读 [核心概念映射](/brokers/kafka/concepts)。
- 想看顺序与回放：[顺序、消费组与回放实验](/labs/ordering)。
