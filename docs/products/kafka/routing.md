# Apache Kafka 分区与分发

> 本页结论：Kafka 的「路由」是 key 到分区的哈希映射——它同时决定局部顺序与负载分布；消费组在分区之上做分配，组内瓜分、组间广播。

## 适用场景

- 同业务键有序的事件流（key=orderId → 同分区 FIFO）。
- 多消费者水平扩展：分区数是组内消费者的并行度上限。
- 多个下游独立消费：每组一份完整数据。

## 核心模型：key → Partition → Consumer Group

```mermaid
flowchart LR
  P[Producer] -- "hash(key) % 分区数" --> P0[(Partition 0)]
  P -- "" --> P1[(Partition 1)]
  P -- "" --> P2[(Partition 2)]
  subgraph 组A[Consumer Group A]
    C1[consumer a-1]
    C2[consumer a-2]
  end
  P0 --> C1
  P1 --> C2
  P2 --> C2
  C3[Consumer Group B（独立位点，全量）] --> P0
```

- 同一 key 的消息总是进同一分区 → 分区内顺序写入（ordering-replay 实验断言 `samePartitionOnProduce=1`）。
- 无 key 的消息按 Sticky 策略分布到各分区（批量内轮转、批间尽量粘连），目的是摊匀负载并保留批内局部性。
- **跨分区没有全局顺序**——「Kafka 保证全局顺序」是禁止表述。

动手验证：

```bash
bash demos/kafka/ordering-replay/run.sh
```

<LabOutput product="kafka" lab="ordering-replay" />

## 消费组分配与再均衡

- 组内：每个分区至多分配给组内一个消费者；消费者数 > 分区数时，多出来的消费者空转（这就是「消费者数量上限 = 分区数」的关系）。
- 成员变化（加入/退出/崩溃、订阅 Topic 分区数变化）触发 **再均衡（rebalance）**：期间消费暂停，分区重新分配；已提交 offset 决定新属主从哪继续。
- 本仓库 consumer-group 实验用两个消费者瓜分 3 分区，随后独立组 b 再次全量接收：

```bash
bash demos/kafka/consumer-group/run.sh
```

<LabOutput product="kafka" lab="consumer-group" />

## Offset 回放

`ordering-replay` 同时验证组级位点：消费组 `g1` 首次顺序读取 6 条消息后，新消费组 `g2` 使用 `auto.offset.reset=earliest` 从 offset 0 全量读取。`g1` 的消费不会改变 `g2` 的起点，因为日志保留与消费进度彼此独立。

核心断言为：6 条消息落在同一分区、首次观察顺序为 1 到 6、回放仍读取 6 条且从 offset 0 开始。

[在 Kafka 实验台查看首次消费与回放轨道](/playground/kafka?scenario=ordering-replay&track=initial)。

## 分区数怎么选

- 分区数 ≈ 目标消费并行度；扩容消费者只能到分区数为止，扩分区不可逆（且会打乱既有 key 分布）。
- 分区过多会增加元数据、文件句柄与端到端延迟（Producer 按分区分批）。
- 顺序需求决定 key 的选择（orderId 而非 userId 还是二者组合），热点 key 会造成单分区倾斜。

## 常见误区

- 「key 相同就一定相邻消费」——只保证同分区顺序；消费端多线程拆分处理同一分区会破坏顺序。
- 「增加消费者总能提速」——超过分区数后新消费者拿不到分区。
- 「再均衡是无感的」——cooperative 协议减少了停顿，但 rebalance 仍意味着短暂的消费中断与位点重读风险（提交太早会重复）。
- 「无 key 消息完全随机分布」——Sticky 分区器有批内粘连语义，不是纯随机轮转。

## 官方资料

- Producer（分区策略）：<https://kafka.apache.org/documentation/#theproducer>（checkedAt: 2026-08-19）
- The Consumer（组与位点）：<https://kafka.apache.org/documentation/#theconsumer>（checkedAt: 2026-08-19）
- Consumer Configs（partition.assignment.strategy）：<https://kafka.apache.org/documentation/#consumerconfigs>（checkedAt: 2026-08-19）
