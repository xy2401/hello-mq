# 实验总览

> 本页结论：hello-mq 的全部实验使用统一入口、统一日志与统一断言；本页给出实验清单、分级与运行方式。

## 为什么需要实验

消息系统的很多结论都附带前置条件：哪个 Broker 版本、什么配置、客户端如何确认。没有可复现实验支撑的结论，在本仓库只会以「规范层面」标注，不会写成事实断言。因此每个关键行为尽量落到一次可以重复执行的 Docker 实验，并把输出日志提交进仓库（见 [证据政策](/reference/evidence-policy)）。

## 实验清单

| 产品 | 实验 | 等级 | 验证目标 |
| :--- | :--- | :--- | :--- |
| RabbitMQ | [basic](/matrix/experiment/basic-flow) | L1 | durable 队列 + Publisher Confirms + 手动 ACK + 幂等落库的最小闭环 |
| RabbitMQ | [routing](/matrix/experiment/poison-message#routing) | L1 | Topic Exchange 按路由键把同一事件分发给不同绑定 |
| RabbitMQ | [consumer-crash](/matrix/experiment/consumer-crash) | L2 | 消费者在业务提交后、ACK 前崩溃 → 重投递 → 幂等表拦截 |
| RabbitMQ | [retry-dlq](/matrix/experiment/poison-message) | L2 | 毒消息经 TTL+DLX 重试环最终进入死信队列 |
| RabbitMQ | [backlog-recovery](/matrix/experiment/backlog-recovery) | L2 | 无消费者时消息积压，消费者恢复后追赶清零 |
| Kafka | [basic](/products/kafka/quick-start) | L1 | acks=all + 幂等生产 + 手动提交 offset + 幂等落库的最小闭环 |
| Kafka | [consumer-group](/matrix/experiment/ordering) | L2 | 同组两个消费者瓜分分区，独立组各自全量接收 |
| Kafka | [ordering-replay](/matrix/experiment/ordering) | L2 | 同 key 消息进同一分区且保序，新消费组从 earliest 全量回放 |
| Kafka | [idempotence-transaction](/products/kafka/reliability) | L2 | 事务提交消息对 read_committed 可见，中止事务消息不可见 |
| RocketMQ | [basic](/products/rocketmq/quick-start) | L1 | Normal topic + SimpleConsumer + 幂等落库的最小闭环 |
| RocketMQ | [fifo-delay](/products/rocketmq/routing) | L2 | FIFO topic 同 MessageGroup 保序，延迟消息按设定时间投递 |
| RocketMQ | [transaction](/products/rocketmq/reliability) | L2 | Half Message 首查 UNKNOWN、回查后 COMMIT，消息恰好消费一次 |
| RocketMQ | [retry-dlq](/products/rocketmq/reliability) | L2 | 消费失败按内置重试重投，达上限进入 %DLQ% 组 topic |
| Pulsar | [basic](/products/pulsar/quick-start) | L1 | Exclusive 订阅 + 业务提交后才 ack + 幂等落库的最小闭环 |
| Pulsar | [subscriptions](/products/pulsar/routing) | L2 | 四类订阅对比：Exclusive/Shared/Failover/Key_Shared |
| Pulsar | [redelivery-replay](/products/pulsar/reliability) | L2 | negativeAck 重投达上限进 DLQ，reset-cursor 全量回放 |
| NATS | [core-pubsub](/products/nats/quick-start) | L1 | Core NATS 即发即忘与订阅收发的最小闭环 |
| NATS | [jetstream-replay](/products/nats/quick-start) | L2 | JetStream 持久化流与按序重放 |
| Redis Streams | [basic](/products/redis-streams/quick-start) | L1 | XADD/XREADGROUP + 消费确认 + 幂等落库的最小闭环 |
| Redis Streams | [consumer-crash](/products/redis-streams/reliability) | L2 | 消费者崩溃后 PEL 滞留，XCLAIM 接管不丢不重 |
| ActiveMQ Artemis | [basic](/products/artemis/quick-start) | L1 | JMS 收发 + 手动确认 + 幂等落库的最小闭环 |
| ActiveMQ Artemis | [retry-dlq](/products/artemis/reliability) | L2 | 服务端重投达上限进入死信地址 |

等级定义见 [实验约定](/guide/lab-conventions)：L0 静态检查、L1 单节点冒烟、L2 可靠性行为、L3/L4 默认不执行。

## 运行方式

每个实验一个自包含目录，`run.sh` 即完整流程：

```bash
# 运行单个实验
bash demos/rabbitmq/basic/run.sh

# 运行某产品全部实验
for s in demos/rabbitmq/*/run.sh; do bash "$s"; done

# 运行全部实验
for s in demos/*/*/run.sh; do bash "$s"; done
```

每个实验都会：

1. 用项目名隔离的 Compose Project（`hello-mq-<product>-<lab>`）启动完整流程（broker → setup → producer → consumer → inspect-db）；
2. 由 `depends_on` 的 `service_healthy` / `service_completed_successfully` 条件等待与排序，而不是固定等待；
3. producer/consumer 以容器服务运行（digest 锁定的 JRE 镜像挂载本机构建的 jar，见 [实验约定](/guide/lab-conventions)）；
4. 执行业务级断言（数量、幂等表行数、队列深度、重投次数），PASS/FAIL 写入 `assert.out.txt`；
5. 结束后自动停止并删除容器，把各角色日志写入实验目录 `<服务>.out.txt`。

::: warning 断言原则
「进程退出码为 0」不等于实验成功。每个实验至少断言：生产确认数、消费数量与唯一 messageId 数、业务落库行数、产品侧状态（队列深度、x-death 计数等），以及失败注入确实发生（如崩溃退出码 137）。
:::

## 输出日志如何阅读

每个实验结束后，各角色输出日志（`producer.out.txt`、`consumer.out.txt` 等）与断言结果（`assert.out.txt`）写入实验目录 `demos/<product>/<lab>/`。每个实验页内嵌一份当前提交的日志：

<LabOutput product="rabbitmq" lab="basic" />

想在自己的机器上复现，运行日志面板里的复现命令即可。

## 下一步

- [基础收发流程](/matrix/experiment/basic-flow)：最短闭环。
- [消费者崩溃与重投](/matrix/experiment/consumer-crash)：Phase 1 的核心实验。
- [毒消息、重试与 DLQ](/matrix/experiment/poison-message)：失败路径。
