# 实验总览

> 本页结论：hello-mq 的全部实验使用统一入口、统一日志与统一断言；本页给出实验清单、分级与运行方式。

## 为什么需要实验

消息系统的很多结论都附带前置条件：哪个 Broker 版本、什么配置、客户端如何确认。没有可复现实验支撑的结论，在本仓库只会以「规范层面」标注，不会写成事实断言。因此每个关键行为尽量落到一次可以重复执行的 Docker 实验，并把归一化后的快照提交进仓库（见 [证据政策](/reference/evidence-policy)）。

## 实验清单

| 产品 | 实验 | 等级 | 验证目标 |
| :--- | :--- | :--- | :--- |
| RabbitMQ | [basic](/labs/basic-flow) | L1 | durable 队列 + Publisher Confirms + 手动 ACK + 幂等落库的最小闭环 |
| RabbitMQ | [routing](/labs/poison-message#routing) | L1 | Topic Exchange 按路由键把同一事件分发给不同绑定 |
| RabbitMQ | [consumer-crash](/labs/consumer-crash) | L2 | 消费者在业务提交后、ACK 前崩溃 → 重投递 → 幂等表拦截 |
| RabbitMQ | [retry-dlq](/labs/poison-message) | L2 | 毒消息经 TTL+DLX 重试环最终进入死信队列 |
| RabbitMQ | [backlog-recovery](/labs/backlog-recovery) | L2 | 无消费者时消息积压，消费者恢复后追赶清零 |
| Kafka | [basic](/brokers/kafka/quick-start) | L1 | acks=all + 幂等生产 + 手动提交 offset + 幂等落库的最小闭环 |
| Kafka | [consumer-group](/labs/ordering) | L2 | 同组两个消费者瓜分分区，独立组各自全量接收 |
| Kafka | [ordering-replay](/labs/ordering) | L2 | 同 key 消息进同一分区且保序，新消费组从 earliest 全量回放 |
| Kafka | [idempotence-transaction](/brokers/kafka/reliability) | L2 | 事务提交消息对 read_committed 可见，中止事务消息不可见 |
| RocketMQ | [basic](/brokers/rocketmq/quick-start) | L1 | Normal topic + SimpleConsumer + 幂等落库的最小闭环 |
| RocketMQ | [fifo-delay](/brokers/rocketmq/routing) | L2 | FIFO topic 同 MessageGroup 保序，延迟消息按设定时间投递 |
| RocketMQ | [transaction](/brokers/rocketmq/reliability) | L2 | Half Message 首查 UNKNOWN、回查后 COMMIT，消息恰好消费一次 |
| RocketMQ | [retry-dlq](/brokers/rocketmq/reliability) | L2 | 消费失败按内置重试重投，达上限进入 %DLQ% 组 topic |
| Pulsar | [basic](/brokers/pulsar/quick-start) | L1 | Exclusive 订阅 + 业务提交后才 ack + 幂等落库的最小闭环 |
| Pulsar | [subscriptions](/brokers/pulsar/routing) | L2 | 四类订阅对比：Exclusive/Shared/Failover/Key_Shared |
| Pulsar | [redelivery-replay](/brokers/pulsar/reliability) | L2 | negativeAck 重投达上限进 DLQ，reset-cursor 全量回放 |

等级定义见 [实验约定](/guide/lab-conventions)：L0 静态检查、L1 单节点冒烟、L2 可靠性行为、L3/L4 默认不执行。

## 运行方式

```bash
# 列出全部实验
npm run lab -- list

# 运行单个实验
npm run lab -- rabbitmq basic

# 运行某产品全部实验
npm run lab -- rabbitmq all

# 清理某产品的实验资源（仅删除本项目 Compose Project）
npm run lab -- rabbitmq clean
```

每个实验都会：

1. 用项目名隔离的 Compose Project（`hello-mq-<product>-<lab>`）启动 Broker；
2. 轮询健康检查而不是固定等待；
3. 先声明拓扑，再运行 Producer 与 Consumer（宿主机 JVM 进程，见 [实验约定](/guide/lab-conventions)）；
4. 执行业务级断言（数量、幂等表行数、队列深度、重投次数），输出 PASS/FAIL；
5. 正常路径自动停止并删除容器，把归一化快照写入 `outputs/<product>/<lab>.snapshot`。

::: warning 断言原则
「进程退出码为 0」不等于实验成功。每个实验至少断言：生产确认数、消费数量与唯一 messageId 数、业务落库行数、产品侧状态（队列深度、x-death 计数等），以及失败注入确实发生（如崩溃退出码 137）。
:::

## 快照如何阅读

快照由 frontmatter（状态、镜像、断言）与归一化日志两部分组成。归一化会把时间戳替换为 `<ts>`、messageId 替换为 `mid-N`、容器标识替换为 `<cid>`，保证不同机器上运行得到可比较的结果。每个实验页内嵌一份当时提交的快照：

<LabOutput product="rabbitmq" lab="basic" />

想在自己的机器上得到同样的结果，运行页面底部的复现命令即可。

## 下一步

- [基础收发流程](/labs/basic-flow)：最短闭环。
- [消费者崩溃与重投](/labs/consumer-crash)：Phase 1 的核心实验。
- [毒消息、重试与 DLQ](/labs/poison-message)：失败路径。
