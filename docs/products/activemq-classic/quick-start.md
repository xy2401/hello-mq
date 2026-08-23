# ActiveMQ Classic 快速开始

> 本页结论：最短闭环——启动单节点 Classic（镜像 digest 锁定、OpenWire 默认匿名），向 `orders-basic` 发 3 条订单事件（队列自动创建，无需预建拓扑），消费者业务落库后才 session.commit()，确认队列深度归零，然后干净清理。

## 前置条件

- Docker（含 Compose v2）与 JDK 21+、Maven。
- 端口 `61616`（OpenWire，默认允许匿名）与 `8161`（Web 控制台，admin/admin）仅绑定到 `127.0.0.1`。
- 匿名访问是本实验的默认配置，不是生产配置；安全基线见 [运维与观测](/products/activemq-classic/operations)。

## 一步运行实验

```bash
bash demos/activemq-classic/basic/run.sh
```

该命令完成整个闭环：启动 Classic（镜像 digest 锁定）→ healthcheck 等 61616 就绪 → Producer persistent send 发 3 条 `OrderCreated.v1` 到 `orders-basic`（队列首次发送时自动创建，同步确认）→ Consumer `SESSION_TRANSACTED` 会话读取、业务写 sqlite 后才 `session.commit()`（幂等表拦截重复）→ 断言（含 `QueueBrowser` 深度为 0，证明 commit 即删除）→ 自动停止并删除容器。

## 手工走一遍（理解每一步）

```bash
cd demos/activemq-classic/basic

# 1. 启动完整流程：activemq → producer → consumer → inspect-db → stats
#    （Classic 无显式建队命令：队列首次收发时自动创建；顺序与健康等待由 depends_on 条件保证）
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
[producer] ... messageId=... destination=orders-basic brokerMessageId=ID:... status=confirmed
```

消费端关键两行（先业务提交，后 session.commit）：

```text
[consumer] ... messageId=... attempt=1 redelivered=false status=received
[consumer] ... messageId=... attempt=1 status=business_committed
```

<LabOutput product="activemq-classic" lab="basic" />

## 调试入口

容器运行期间可用 Web 控制台观察 Queue/Topic 与连接：浏览器打开 `http://127.0.0.1:8161`，默认凭据 admin/admin（镜像 jetty realm）。命令行侧的深度清点用 `QueueBrowser`（本仓库 `stats` 命令即用它）；镜像自带的统一入口 `bin/activemq` 及 producer/consumer/status 等任务见 [运维与观测](/products/activemq-classic/operations) 的 cli-tools 小节。指标读法同页。

## 清理与安全

- run.sh 退出时的 `docker compose down --volumes` 只 down 本实验的 Compose Project（`hello-mq-activemq-classic-basic`），不会碰其他容器或卷。
- 本仓库的实验 Classic 不挂持久卷：KahaDB 数据随容器销毁；生产环境的持久化与高可用取舍见 [存储与高可用](/products/activemq-classic/storage-ha)。

## 下一步

- 概念不熟：读 [核心概念映射](/products/activemq-classic/concepts)。
- 想看失败路径：运行 `bash demos/activemq-classic/retry-dlq/run.sh`，观察 Broker 端重投与默认死信 ActiveMQ.DLQ。

## 官方资料

- Classic 文档首页：<https://activemq.apache.org/components/classic/documentation/>（checkedAt: 2026-08-20）
