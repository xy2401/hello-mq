---
layout: home

hero:
  name: "💬 Hello MQ"
  text: "消息队列与事件流知识百科"
  tagline: "8 个主流 MQ · 统一实验验证 · 三层语义说明 · 横向选型矩阵"
  image: /logo.svg
  alt: Hello MQ - 消息系统学习平台
  actions:
    - theme: brand
      text: 理解核心原理
      link: /concepts/
    - theme: alt
      text: 🧪 可复现实验
      link: /matrix/experiment/
    - theme: alt
      text: ⚖️ 能力对比矩阵
      link: /matrix/

features:
  - icon: 🏗️
    title: 统一知识骨架
    details: 所有产品按相同的十二个公共维度讲解：定位、核心实体、路由分发、存储策略、生产确认、消费投递、顺序保证、失败处理、高可用架构、安全权限、性能瓶颈。
  - icon: 🧪
    title: 真实环境验证
    details: Docker Compose 编排 + Java 21 Demo，复现消费者崩溃重试、毒消息 DLQ、事务回查、幂等拦截等行为；输出经归一化后作为快照提交。
  - icon: 🌐
    title: 三层语义模型
    details: Broker 层（服务端保证）+ Client 层（SDK 行为）+ Business 层（业务补偿），拒绝「无条件的 exactly-once」等模糊断言。
  - icon: 📊
    title: 场景化选型指南
    details: 7 大能力矩阵 × 30+ 技术特性对照表，帮你根据吞吐量需求、一致性要求、运维成本筛选最佳方案。
---

## 🎯 典型消息系统快速入口

前 5 个为高频使用场景的代表性产品，其余 3 个可在导航栏「更多」下拉中查看。

| 产品 | 类型 | 核心价值 | 分卷文档 |
| :--- | :--- | :--- | --- |
| [RabbitMQ](/products/rabbitmq/) 🐰 | Queue | 灵活路由、可靠投递、延迟/优先级队列 | [8 页详解](/products/rabbitmq/) → |
| [Apache Kafka](/products/kafka/) 🦓 | Log | 分区持久日志、高吞吐事件流、实时数据处理 | [8 页详解](/products/kafka/) → |
| [RocketMQ](/products/rocketmq/) 🚀 | Queue-Log | 事务消息、定时/延迟消息、金融级可靠性 | [8 页详解](/products/rocketmq/) → |
| [Apache Pulsar](/products/pulsar/) 🦋 | Log-Cloud | 存算分离、多租户、云原生原生设计 | [8 页详解](/products/pulsar/) → |
| [Redis Streams](/products/redis-streams/) 💾 | Stream | 内存高性能、简单 API、嵌入式事件总线 | [8 页详解](/products/redis-streams/) → |

<div class="grid-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 24px;">

<a href="/products/" style="text-decoration: none;">
  <div style="background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); padding: 20px; border-radius: 12px; height: 100%; transition: all 0.3s ease;">
    <h3 style="margin: 0 0 8px 0; color: var(--vp-c-brand-1);">📚 查看所有 8 个产品</h3>
    <p style="margin: 0; font-size: 0.875rem; color: var(--vp-c-text-2);">包括 NATS JetStream、ActiveMQ Artemis、ActiveMQ Classic</p>
  </div>
</a>

<a href="/matrix/" style="text-decoration: none;">
  <div style="background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); padding: 20px; border-radius: 12px; height: 100%; transition: all 0.3s ease;">
    <h3 style="margin: 0 0 8px 0; color: var(--vp-c-brand-1);">⚖️ 横向能力对比矩阵</h3>
    <p style="margin: 0; font-size: 0.875rem; color: var(--vp-c-text-2);">投递语义、顺序保证、重试与 DLQ、延迟消息、回放保留、扩展复制、安全模型七大维度深度对比</p>
  </div>
</a>

<a href="/matrix/experiment/" style="text-decoration: none;">
  <div style="background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); padding: 20px; border-radius: 12px; height: 100%; transition: all 0.3s ease;">
    <h3 style="margin: 0 0 8px 0; color: var(--vp-c-brand-1);">🔬 15+ 可复现实验手册</h3>
    <p style="margin: 0; font-size: 0.875rem; color: var(--vp-c-text-2);">基础收发、消费者崩溃重投、毒消息 DLQ、事务回查、顺序回放、积压追赶等完整故障演练脚本</p>
  </div>
</a>

</div>

---

## 🔄 从同步调用到事件驱动

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

模型细节与产品对照见[消息模型](/concepts/models)。

---

## 📊 关键能力横向对比

七个产品在核心功能上的支持方式不同——「原生」不等于「免费」，「业务实现」也不等于「不可行」。

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **端到端 exactly-once** | 业务实现 | 仅集群内 EOS | 业务实现 | 业务实现 | 业务实现 | 业务实现 | 业务实现 |
| **顺序消息** | 单队列内 | 分区内 | MessageGroup 内 | 分区 + 订阅类型相关 | 单 Stream 内 | Subject/Stream 内 | 单队列内 + Message Group |
| **内置重试与 DLQ** | 组合配置（TTL+DLX） | 业务实现 | 原生（Broker 内置） | 组合配置（DeadLetterPolicy） | 业务实现（PEL+XCLAIM） | 组合配置（AckWait+MaxDeliver） | 原生（address-setting） |
| **延迟消息** | 组合配置（TTL+DLX） | 业务实现 | 原生（定时投递） | 业务实现 | 不适用 | 原生（JetStream 延迟投递） | 原生（_AMQ_SCHED_DELAY） |
| **消息回放** | 不适用（ACK 即删） | 原生（位点/时间戳） | 原生（位点重置） | 原生（reset-cursor） | 原生（XRANGE/XGROUP SETID） | Core 不适用；JetStream 原生 | 不适用（ack 即删） |

选型没有万能冠军：按输入维度筛选候选，见 [选型指南](/matrix/selection-guide)。

---

## 🚀 本地实验 Quick Start

```bash
git clone https://github.com/xy2401/hello-mq.git && cd hello-mq
npm install

# 运行单个实验
bash demos/rabbitmq/basic/run.sh                 # 启动 RabbitMQ，发 3 条、收 3 条并校验

# 运行全部实验
for s in demos/*/*/run.sh; do bash "$s"; done    # 15 个实验全跑一遍
```

环境要求与完整说明见[实验约定](/guide/lab-conventions)。

适合目标读者：**需要深入理解消息系统底层原理、构建高可靠分布式系统的后端工程师与 SRE**。
