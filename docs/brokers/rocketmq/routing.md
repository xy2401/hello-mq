# Apache RocketMQ 路由与分发

> 本页结论：RocketMQ 的「路由」= Topic 寻址 + Tag 过滤 + MessageQueue 负载分担 + MessageGroup 顺序——四件事分工明确；Tag 管「给谁」，Key 管「怎么查」，二者不可混用。

## 适用场景

- 同业务键有序的事件流（MessageGroup=orderId → 同队列 FIFO）。
- 多消费者水平扩展：MessageQueue 数是组内消费者的分担上限。
- 按事件类型分流：同一 Topic 内用 Tag 过滤，订阅方各取所需。

## 核心模型：Topic → MessageQueue → Consumer Group

```mermaid
flowchart LR
  P[Producer] -- "MessageGroup hash → queue" --> Q0[(MessageQueue 0)]
  P -- "" --> Q1[(MessageQueue 1)]
  P -- "" --> Q2[(MessageQueue 2)]
  subgraph 组A[Consumer Group A]
    C1[consumer a-1]
    C2[consumer a-2]
  end
  Q0 --> C1
  Q1 --> C2
  Q2 --> C2
  C3[Consumer Group B（独立进度，全量）] --> Q0
```

- 同一 MessageGroup 的消息总是进同一队列 → 队列内顺序写入与消费（fifo-delay 实验断言 `observedOrder=[1,2,3]`、`sameMessageGroup=3`）。
- 不带 MessageGroup 的消息（Normal Topic）按负载均衡分布到各队列。
- **跨队列没有全局顺序**——顺序只在同队列内成立。

动手验证（FIFO 保序 + 定时消息延迟 ≥3s）：

```bash
bash demos/rocketmq/fifo-delay/run.sh
```

<LabOutput product="rocketmq" lab="fifo-delay" />

## Tag 过滤 vs Key 索引

| 属性 | 用途 | 生效位置 | 典型用法 |
| :--- | :--- | :--- | :--- |
| Tag | **过滤**：订阅表达式按 Tag 筛消息 | Broker 侧（也可客户端再过滤） | `OrderCreated`/`OrderPaid` 分流 |
| Key | **索引/检索 + 业务关联**：按 Key 建索引、查消息、串联业务 | Broker 侧索引（IndexFile） | messageId、orderId 查询与追踪 |

- Tag 回答「这条消息要不要给我」，Key 回答「这条消息能不能被查出来」。
- 本仓库 Demo 把 `eventType` 设为 Tag、`messageId` 设为 Key，并把 traceId/aggregateId 放进消息属性。
- 用 Tag 当业务主键、或用 Key 做订阅过滤，都是错误用法。

## 与 Kafka 分区、RabbitMQ Exchange 的对照

| 维度 | RocketMQ MessageQueue | Kafka Partition | RabbitMQ Exchange/Queue |
| :--- | :--- | :--- | :--- |
| 角色 | 分片：顺序 + 分担 + 负载 | 分片：顺序 + 并行 + 复制 | Exchange 路由、Queue 存储，二者分离 |
| 顺序键 | MessageGroup（FIFO Topic） | key | 无原生分区概念（单队列内） |
| 选择性订阅 | Tag 过滤 | 无（整分区消费） | Binding（routing key/headers） |
| 消费删除 | 否（保留期清理） | 否（retention） | 是（ACK 即删） |

## FIFO 的顺序边界与失败阻塞风险

- FIFO Topic 中，一个队列同一时刻只被组内一个消费者**串行**处理；顺序保证的范围 = 同一 MessageGroup。
- 消费失败时该队列**暂停推进**，等待重试——后续同队列消息被阻塞（失败阻塞风险）。这是「保序」的代价。
- 需要「同 orderId 严格有序」：MessageGroup=orderId；能容忍乱序的流量放 Normal Topic 以换取吞吐。

## 常见误区

- 「MessageGroup 相同就一定相邻消费」——只保证同队列顺序；消费端返回 FAILURE 会阻塞队列推进。
- 「增加消费者总能提速」——超过队列数后新消费者分不到队列。
- 「Tag 和 Key 是一回事」——一个管过滤、一个管索引/业务关联。
- 「Normal Topic 也能保序」——保序必须 FIFO Topic + MessageGroup 配合。

## 官方资料

- Topic：<https://rocketmq.apache.org/docs/domainModel/02topic>（checkedAt: 2026-08-19）
- 特性行为（Topic）：<https://rocketmq.apache.org/docs/featureBehavior/01topic>（checkedAt: 2026-08-19）
