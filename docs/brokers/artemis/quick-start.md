# ActiveMQ Artemis 快速开始

> 本页结论：最短闭环——启动单节点 Artemis（挂载实验用 broker.xml），向 anycast 队列发 3 条订单事件，消费者业务落库后 acknowledge，确认队列深度归零，然后干净清理。

## 前置条件

- Docker（含 Compose v2）与 JDK 21+、Maven。
- 端口 `61616`（全协议 acceptor）与 `8161`（Web 控制台）仅绑定到 `127.0.0.1`。

## 一步运行实验

```bash
npm run lab -- artemis basic
```

该命令完成整个闭环：启动 Artemis（镜像 digest 锁定）→ 等待 61616 acceptor 就绪 → Producer 经 JMS `send` 发 3 条 `OrderCreated.v1` 到 `orders-basic`（同步确认）→ Consumer `CLIENT_ACKNOWLEDGE` 会话读取、业务落库后 `acknowledge` → 断言（含 `QueueBrowser` 深度为 0，证明 ack 即删除）→ 自动停止并删除容器。

## 手工走一遍（理解每一步）

```bash
# 1. 启动 Artemis（compose 文件锁定镜像 digest；项目名与 lab.js 一致）
docker compose -p hello-mq-artemis-basic --env-file .env.versions \
  -f compose/artemis.compose.yml up -d

# 2. 等待健康（轮询，而不是固定 sleep）
node scripts/wait-for-service.js hello-mq-artemis-basic \
  compose/artemis.compose.yml artemis 90 .env.versions

# 3. 发送与消费（lab 内部同样调用这些目标；队列首次收发时自动创建）
mvn -B -q -f demos/pom.xml -pl artemis -am package -DskipTests
java -jar demos/artemis/target/hello-mq-artemis.jar produce --lab=basic \
  --queue=orders-basic --files=order-1001.json,order-1002.json,order-1003.json
java -jar demos/artemis/target/hello-mq-artemis.jar consume --lab=basic \
  --queue=orders-basic --db=.lab/idempotency.db --expected=3

# 4. 观察关键语义：确认后队列深度归零
java -jar demos/artemis/target/hello-mq-artemis.jar stats --lab=basic --queue=orders-basic

# 5. 清理（仅删除本项目的 Compose Project）
npm run lab -- artemis clean
```

## 预期输出

每条日志都是统一的 key=value 结构（规格 §12.2），生产端关键一行（`brokerMessageId` 为 JMSMessageID）：

```text
[producer] ... messageId=... destination=orders-basic brokerMessageId=... status=confirmed
```

消费端关键两行（先业务提交，后 acknowledge）：

```text
[consumer] ... messageId=... attempt=1 redelivered=false status=received
[consumer] ... messageId=... attempt=1 status=business_committed
```

## 调试入口

容器运行期间可用 Web 控制台（hawtio）观察地址/队列：浏览器打开 `http://127.0.0.1:8161/console`，凭据为 compose 中的 `ARTEMIS_USER/ARTEMIS_PASSWORD`。命令行侧可用 `QueueBrowser`（本仓库 `stats` 命令即用它），或容器内 `artemis` CLI：

```bash
docker compose -p hello-mq-artemis-basic -f compose/artemis.compose.yml \
  exec artemis /opt/activemq-artemis/bin/artemis queue stat \
  --url tcp://127.0.0.1:61616 --user admin --password hello-mq-artemis
```

指标读法见 [运维与观测](/brokers/artemis/operations)。

## 清理与安全

- `npm run lab -- artemis clean` 只 down 本仓库的 Compose Project（`hello-mq-artemis-*`），不会碰其他容器或卷。
- 本仓库的实验 Artemis 不挂持久卷：journal 数据随容器销毁；生产环境的持久化与复制取舍见 [存储与高可用](/brokers/artemis/storage-ha)。

## 下一步

- 概念不熟：读 [核心概念映射](/brokers/artemis/concepts)。
- 想看失败路径：运行 `npm run lab -- artemis retry-dlq`，观察服务端重投与死信地址。
