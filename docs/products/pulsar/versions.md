# Apache Pulsar 版本演进

Apache Pulsar 采用天然的计算与存储分离（Broker + Apache BookKeeper）架构，以多租户与百万分区扩展见长。

## 核心版本演进与关键里程碑

### Pulsar 3.0 LTS（2023 年 5 月）

**主要功能与架构演进：**

- Pulsar 首个官方长期支持版本（LTS），确立企业级稳定交付承诺
- 引入全新的元数据服务抽象层（Metadata Store API），降低对单一 ZooKeeper 的依赖
- 重构消息确认与事务日志提交性能，高并发写入吞吐提升 30%

**工程影响与选型建议：**

> 企业生产环境构建多租户流平台的黄金基线。

### Pulsar 2.8（2021 年 6 月）

**主要功能与架构演进：**

- 原生引入跨 Topic 与跨命名空间的分布式事务支持
- 支持单次事务内同时原子发送与批量 ACK 消息

**工程影响与选型建议：**

> 实现端到端 Exactly-Once 流式数据处理。

## 升级核对
- 跨大版本升级需先逐节点滚动升级 BookKeeper (Bookie)，再升级 Pulsar Broker 节点。
