# ActiveMQ Artemis 快速开始

> 本页结论：最短闭环——启动单节点 Artemis（挂载实验用 broker.xml），向 anycast 队列发 3 条订单事件，消费者业务落库后 acknowledge，确认队列深度归零，然后干净清理。

## 前置条件

- Docker（含 Compose v2）与 JDK 21+、Maven。
- 端口 `61616`（全协议 acceptor）与 `8161`（Web 控制台）仅绑定到 `127.0.0.1`。

## 一步运行实验

```bash
bash demos/artemis/basic/run.sh
```

该命令完成整个闭环：启动 Artemis（镜像 digest 锁定）→ 等待 61616 acceptor 就绪 → Producer 经 JMS `send` 发 3 条 `OrderCreated.v1` 到 `orders-basic`（同步确认）→ Consumer `CLIENT_ACKNOWLEDGE` 会话读取、业务落库后 `acknowledge` → 断言（含 `QueueBrowser` 深度为 0，证明 ack 即删除）→ 自动停止并删除容器。

## 手工走一遍（理解每一步）

```bash
cd demos/artemis/basic

# 1. 启动完整流程：artemis → producer → consumer → inspect-db → stats
#    （队列首次收发时自动创建；顺序与健康等待由 depends_on 条件保证）
docker compose --env-file ../../../.env.versions up -d
docker compose wait stats

# 2. 观察关键语义：确认后队列深度归零（stats 服务的日志即 QueueBrowser 深度）
docker compose logs stats

# 3. 查看各角色日志与退出码
docker compose logs producer consumer
docker compose ps --all

# 4. 清理（仅删除本实验的 Compose Project）
docker compose --env-file ../../../.env.versions down --volumes
```

## 预期输出

每条日志都是统一的 key=value 结构，生产端关键一行（`brokerMessageId` 为 JMSMessageID）：

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
# 在 demos/artemis/basic 目录执行
docker compose exec artemis /opt/activemq-artemis/bin/artemis queue stat \
  --url tcp://127.0.0.1:61616 --user admin --password hello-mq-artemis
```

指标读法见 [运维与观测](/products/artemis/operations)。

## 清理与安全

- run.sh 退出时的 `docker compose down --volumes` 只 down 本实验的 Compose Project（`hello-mq-artemis-basic`），不会碰其他容器或卷。
- 本仓库的实验 Artemis 不挂持久卷：journal 数据随容器销毁；生产环境的持久化与复制取舍见 [存储与高可用](/products/artemis/storage-ha)。

## 下一步

- 概念不熟：读 [核心概念映射](/products/artemis/concepts)。
- 想看失败路径：运行 `bash demos/artemis/retry-dlq/run.sh`，观察服务端重投与死信地址。
