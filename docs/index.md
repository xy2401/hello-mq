---
layout: home
hero:
  name: hello-mq
  text: 消息队列、事件流与可靠消息模式
  tagline: 用统一实验场景解释消息系统核心语义，用可运行的容器化 Demo 验证关键结论，用横向矩阵说明能力边界与选型依据
  actions:
    - theme: brand
      text: 基础原理
      link: /fundamentals/
    - theme: alt
      text: 横向矩阵与选型
      link: /matrix/
    - theme: alt
      text: 进入实验室
      link: /labs/

features:
  - icon: 🧭
    title: 统一知识骨架
    details: 所有产品按相同的十二个公共维度讲解：定位、核心实体、路由、存储、生产/消费可靠性、投递语义、顺序、失败处理、高可用、安全与可观测、限制与反模式。
  - icon: 🧪
    title: 可运行实验与验证快照
    details: 消费者崩溃重投、毒消息与 DLQ、幂等拦截、事务与回放等行为由 Docker Compose + Java 21 Demo 复现，实验输出经归一化后作为快照提交，可一键复现。
  - icon: ⚖️
    title: 三层语义说明法
    details: 每项“保证”都拆成 Broker 层、Client 层与 Business 层，区分规范保证、配置条件、客户端行为与业务端补偿，不写无条件的 exactly-once。
---

## 产品覆盖

| 产品 | 状态 | 代表性 | 分卷 | 实验 |
| :--- | :--- | :--- | :--- | :--- |
| <ProductLogo product="rabbitmq" /> RabbitMQ | ✅ 已落地 | 传统消息队列与灵活路由 | [8 页](/brokers/rabbitmq/) | 5 个（basic / routing / consumer-crash / retry-dlq / backlog-recovery） |
| <ProductLogo product="kafka" /> Apache Kafka | ✅ 已落地 | 分区式持久日志与事件流 | [8 页](/brokers/kafka/) | 4 个（basic / consumer-group / ordering-replay / idempotence-transaction） |
| <ProductLogo product="rocketmq" /> Apache RocketMQ | ✅ 已落地 | 面向业务消息的分布式中间件 | [8 页](/brokers/rocketmq/) | 4 个（basic / fifo-delay / transaction / retry-dlq） |
| <ProductLogo product="pulsar" /> Apache Pulsar | ✅ 已落地 | 存储计算分离、云原生多租户 | [8 页](/brokers/pulsar/) | 3 个（basic / subscriptions / redelivery-replay） |
| <ProductLogo product="redis" /> Redis Streams | ✅ 已落地 | Redis 内的追加日志与消费组 | [8 页](/brokers/redis-streams/) | 2 个（basic / consumer-crash） |
| <ProductLogo product="nats" /> NATS + JetStream | ✅ 已落地 | 低延迟 Core NATS 与持久化 JetStream | [8 页](/brokers/nats/) | 2 个（core-pubsub / jetstream-replay） |
| ActiveMQ Artemis | ✅ 分卷落地（快照未采集） | 多协议 JMS Broker：anycast/multicast、服务端重试与死信、XA 事务 | [8 页](/brokers/artemis/) | 2 个编排就绪（basic / retry-dlq） |

## 从同步调用到事件驱动

切换下面的模式，观察调用关系如何从「点对点强耦合」演化为「经 Broker 解耦」；点「播放消息流」可高亮一条消息的流转路径。

<TopologyDiagram
  title="交互拓扑：同步调用 → 事件驱动"
  :modes="[
    {
      name: '同步调用',
      description: '订单服务逐个直调下游：任一环节慢或挂，整条链路一起慢、一起挂。',
      nodes: [
        { id: 'order', label: '订单服务', kind: 'producer' },
        { id: 'stock', label: '库存服务', kind: 'consumer' },
        { id: 'points', label: '积分服务', kind: 'consumer' },
        { id: 'notify', label: '通知服务', kind: 'consumer' },
      ],
      edges: [
        { from: 'order', to: 'stock', label: 'HTTP，阻塞等待' },
        { from: 'order', to: 'points', label: 'HTTP，阻塞等待' },
        { from: 'order', to: 'notify', label: 'HTTP，阻塞等待' },
      ],
    },
    {
      name: 'Queue 工作队列',
      description: '订单只发一条事件到队列，多个工作者竞争消费、负载均衡；消费失败可重投。',
      nodes: [
        { id: 'order', label: '订单服务', kind: 'producer' },
        { id: 'queue', label: 'Queue（Broker）', kind: 'broker' },
        { id: 'w1', label: '工作者 A', kind: 'consumer' },
        { id: 'w2', label: '工作者 B', kind: 'consumer' },
      ],
      edges: [
        { from: 'order', to: 'queue', label: '发布事件后即返回' },
        { from: 'queue', to: 'w1', label: '竞争投递' },
        { from: 'queue', to: 'w2', label: '竞争投递' },
      ],
    },
    {
      name: 'Pub/Sub 广播',
      description: '一条 OrderCreated 事件扇出给所有订阅方：各下游独立订阅、互不影响。',
      nodes: [
        { id: 'order', label: '订单服务', kind: 'producer' },
        { id: 'exchange', label: 'Topic/Exchange', kind: 'broker' },
        { id: 'stock', label: '库存订阅方', kind: 'consumer' },
        { id: 'points', label: '积分订阅方', kind: 'consumer' },
        { id: 'notify', label: '通知订阅方', kind: 'consumer' },
      ],
      edges: [
        { from: 'order', to: 'exchange', label: 'OrderCreated' },
        { from: 'exchange', to: 'stock', label: '每订阅方各一份' },
        { from: 'exchange', to: 'points', label: '每订阅方各一份' },
        { from: 'exchange', to: 'notify', label: '每订阅方各一份' },
      ],
    },
    {
      name: '分区日志',
      description: '消息追加进分区、按位点编号；多个消费组各自维护位点，可随时回放（Kafka/Pulsar 模型）。',
      nodes: [
        { id: 'order', label: '订单服务', kind: 'producer' },
        { id: 'p0', label: 'Partition 0', kind: 'broker' },
        { id: 'g1', label: '消费组：计费', kind: 'consumer' },
        { id: 'g2', label: '消费组：审计', kind: 'consumer' },
      ],
      edges: [
        { from: 'order', to: 'p0', label: '按 key 分区追加' },
        { from: 'p0', to: 'g1', label: '按位点顺序读' },
        { from: 'p0', to: 'g2', label: '独立位点，可回放' },
      ],
    },
  ]"
/>

模型细节与产品对照见[消息模型](/fundamentals/models)。

## 验证快照示例：消费者崩溃与幂等拦截

下面是一次真实运行的 consumer-crash 实验快照：消费者在业务提交后、ACK 前崩溃（exit 137），重启后重投被幂等表拦截为 `duplicate_skipped`，业务表最终恰好 3 行。

<LabOutput product="rabbitmq" lab="consumer-crash" />

完整解读见[消费者崩溃与重投](/labs/consumer-crash)。

## 横向矩阵速览

七个产品在关键能力上的支持方式不同——「原生」不等于「免费」，「业务实现」也不等于「不可行」。完整矩阵与证据链接见 [横向矩阵](/matrix/)。

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 端到端 exactly-once | 业务实现 | 仅集群内 EOS | 业务实现 | 业务实现 | 业务实现 | 业务实现 | 业务实现 |
| 顺序消息 | 单队列内 | 分区内 | MessageGroup 内 | 分区 + 订阅类型相关 | 单 Stream 内 | Subject/Stream 内 | 单队列内 + Message Group |
| 内置重试与 DLQ | 组合配置（TTL+DLX） | 业务实现 | 原生（Broker 内置） | 组合配置（DeadLetterPolicy） | 业务实现（PEL+XCLAIM） | 组合配置（AckWait+MaxDeliver） | 原生（address-setting） |
| 延迟消息 | 组合配置（TTL+DLX） | 业务实现 | 原生（定时投递） | 业务实现 | 不适用 | 原生（JetStream 延迟投递） | 原生（_AMQ_SCHED_DELAY） |
| 消息回放 | 不适用（ACK 即删） | 原生（位点/时间戳） | 原生（位点重置） | 原生（reset-cursor） | 原生（XRANGE/XGROUP SETID） | Core 不适用；JetStream 原生 | 不适用（ack 即删） |

选型没有万能冠军：按输入维度筛选候选，见 [选型指南](/matrix/selection-guide)。

## 本地实验 Quick Start

```bash
git clone <repo-url> && cd hello-mq
npm install

bash demos/rabbitmq/basic/run.sh                 # 启动 RabbitMQ，发 3 条、收 3 条并校验
for s in demos/*/*/run.sh; do bash "$s"; done    # 运行全部实验
```

环境要求与完整说明见[快速开始](/guide/getting-started)。
