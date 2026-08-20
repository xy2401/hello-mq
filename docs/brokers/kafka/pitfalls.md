# Apache Kafka 陷阱与检查表

> 本页结论：汇总 Kafka 的默认值陷阱与错误类比，给出一份可逐项打钩的生产上线检查表。

## 默认值陷阱

| 默认/常见配置 | 陷阱 | 正确做法 |
| :--- | :--- | :--- |
| `acks` 旧版本默认 1 | Leader 确认 ≠ 副本可读，Leader 崩溃丢在途消息 | `acks=all` + `min.insync.replicas≥2` |
| `enable.auto.commit=true` | 按时间提交 poll 位点，处理中崩溃丢/重复 | 手动 `commitSync`，业务提交后才提交 |
| 未开 `enable.idempotence` | 网络重试产生重复记录 | 开启幂等（本仓库默认） |
| `auto.create.topics.enable=true` | 拼错 Topic 名静默创建空 Topic | 关闭，拓扑在部署流程显式创建 |
| 分区数拍脑袋定 | 分区数 = 并行度上限，且扩分区不可逆 | 按峰值消费速率与 key 分布评估 |
| `max.poll.interval.ms` 默认 5 分钟 | 处理超时被踢出组 → 反复 rebalance 与重读 | 缩短单批处理时间或调大参数 |
| 消费端多线程处理分区消息 | 分区内顺序被打破 | 分区内单线程，或按 key 再分发 |

位点提交是最典型的 Before/After：提交 offset 只代表「拉到了这里」，不代表「业务做完了」。

<ConfigDiff
  title="消费位点提交：Before / After"
  :panes='[
    {
      product: "Before",
      title: "enable.auto.commit=true",
      risk: "high",
      code: `props.put("enable.auto.commit", "true");
props.put("auto.commit.interval.ms", "5000");
while (running) {
  for (ConsumerRecord<String, String> r : consumer.poll(Duration.ofMillis(500))) {
    handle(r);            // 处理中崩溃：位点已按时间推进 → 丢消息
  }                       // 处理慢于提交间隔 → 重复处理
}`,
    },
    {
      product: "After",
      title: "业务提交后再 commitSync",
      risk: "safe",
      code: `props.put("enable.auto.commit", "false");
while (running) {
  ConsumerRecords<String, String> batch = consumer.poll(Duration.ofMillis(500));
  handleBatch(batch);     // 先落库（含幂等表，见 /patterns/idempotent-consumer）
  consumer.commitSync();  // 业务提交后才推进位点：崩溃 → 重投 → 幂等拦截
}`,
    },
  ]'
  note="提交 offset ≠ 业务提交：前者只是消费进度指针，后者才决定重复还是丢失（见三层语义说明 /fundamentals/delivery-semantics）。"
  appliesTo="kafka-clients 4.3.1（Kafka 4.x；结论同样适用于 2.x/3.x 的相同参数）"
/>

## 错误类比与禁止表述

以下表述在本仓库视为错误：

1. **「Kafka 保证全局顺序」**
   真相：顺序只在**分区内**成立。跨分区、再均衡后的交接、多线程消费都可能打乱全局顺序；需要全局顺序只能单分区（牺牲并行度）。本仓库 [ordering-replay 实验](/labs/ordering) 验证的是同 key 同分区的局部顺序。

2. **「提交 offset 等于业务数据库已成功提交」**
   真相：offset 在 Kafka，业务数据在另一个系统，两者之间必有崩溃窗口。正确顺序是业务事务提交后才 commitSync，并用幂等表拦截重读（[basic 实验快照](/brokers/kafka/reliability) 即此实现）。

3. **「开启事务后，任意外部系统副作用都是 exactly-once」**
   真相：Kafka 事务保证的是 Kafka 内部（produce、sendOffsetsToTransaction）的原子性；数据库、HTTP 等外部副作用不在事务范围内，仍需幂等设计。[idempotence-transaction 实验](/brokers/kafka/reliability) 验证的也是 Kafka 内部可见性。

其他常见错误类比：

- 「Partition = RabbitMQ Queue」——分区是日志（消费不删除、有回放），队列是 ACK 即删；消费模型不可互译。
- 「Consumer Group 就是订阅关系」——组还是位点（offset）的所有者；删组/改组名 = 从头或从默认位点重读。
- 「Kafka 有内置 DLQ」——没有；Retry Topic/DLQ 是应用或框架模式，Kafka 只负责把消息留在日志里。

## 反模式清单

- 一个 Topic 塞所有事件类型还要求顺序：不同事件处理速度不同，慢事件阻塞整个分区。→ 按事件类型拆 Topic 或接受同分区阻塞语义。
- 用 Kafka 当「数据库」做点查：日志是流式读，点查应投到下游索引。
- 消费失败无限重试同一分区：毒消息阻塞后续全部消息（无内置重试可跳过）。→ 转发 DLQ Topic + 告警。
- 频繁扩分区追并行度：key 分布被打散，历史顺序假设失效。
- 把单机 Demo 吞吐当生产基准：本仓库单节点 KRaft 数字只用于行为验证。

## 生产上线检查表

- [ ] 生产端：`acks=all`、`enable.idempotence=true`、`min.insync.replicas≥2`（配合 RF≥3）。
- [ ] 消费端：手动 commitSync，晚于业务事务提交；`max.poll.interval.ms` 与批大小匹配处理能力。
- [ ] 幂等：`messageId` 唯一键表与业务写入同事务；重读场景已演练（位点重置实验可复用为验收用例）。
- [ ] 失败路径：毒消息有 DLQ Topic 与告警；理解「失败消息会阻塞分区」的后果并选择跳过或停线。
- [ ] Topic 治理：关闭自动建 Topic；分区数、key 选择、retention 有明确记录。
- [ ] 保留策略：retention 时长 ≥ 最大可接受恢复窗口；消费组 lag 告警阈值小于 retention 余量。
- [ ] 高可用：RF≥3、controller quorum 独立（生产）、`unclean.leader.election.enable=false`。
- [ ] 安全：SASL+TLS、ACL 最小授权；管理端口与 JMX 不暴露公网。
- [ ] 观测：lag、under-replicated、rebalance、磁盘使用有看板；traceId 贯穿两端日志。
- [ ] 版本：镜像与客户端版本锁定（参考 `.env.versions` 的 tag+digest 双锁）。

## 官方资料

- Delivery Semantics：<https://kafka.apache.org/documentation/#semantics>（checkedAt: 2026-08-19）
- Operations：<https://kafka.apache.org/documentation/#operations>（checkedAt: 2026-08-19）
