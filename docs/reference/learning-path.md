# 学习路径

> 本页结论：不同角色的读者按推荐路径使用 hello-mq，先建立统一语义，再进入产品分卷与实验。

## 前置共识

无论选择哪条路径，都建议先完成两件事：

1. 读完[基础原理](/#mq-fundamentals)，掌握中性术语（Queue、Topic、Partition、Subscription、ACK、Offset 等），避免把不同产品的同名概念直接等价。
2. 跑通 `bash demos/rabbitmq/basic/run.sh`，理解实验如何断言“生产确认、消费确认、业务落库”三个独立状态。

## 角色路径

| 读者 | 主要诉求 | 推荐路径 |
| :--- | :--- | :--- |
| 后端初学者 | 理解队列、发布订阅、ACK、重试 | [投递语义](/#mq-delivery-semantics) → [RabbitMQ 概念映射](/products/rabbitmq/concepts) → [基础收发](/products/rabbitmq/quick-start) → [崩溃重投](/products/rabbitmq/reliability) |
| Java/服务端开发者 | 可靠投递、幂等、事务一致性 | [RabbitMQ 可靠性](/products/rabbitmq/reliability) → [Kafka 可靠性](/products/kafka/reliability) → [RocketMQ 可靠性](/products/rocketmq/reliability) |
| 架构师 | 产品边界、容量模型、选型 | 基础原理全部 → RabbitMQ [陷阱与检查表](/products/rabbitmq/pitfalls) → 后续横向矩阵 |
| SRE/平台工程师 | 积压、监控、故障恢复 | [背压与积压](/#mq-backpressure) → [运维与观测](/products/rabbitmq/operations) → 故障实验 |
| 数据/流处理开发者 | 分区日志、回放、消费组 | [存储与回放](/#mq-storage-and-replay) → [顺序语义](/#mq-ordering) → 后续 Kafka/Pulsar 分卷 |

## 学习方法建议

- **先断言，后结论**：每个可靠性结论先问“实验断言了什么？”——只观察进程退出码不算验证。
- **三层拆解**：遇到“保证不丢/恰好一次”的说法，拆成 Broker 层、Client 层、Business 层分别核对条件。
- **复现优先**：文档中的每个实验都提供一键复现命令；先复现，再改参数观察差异。
