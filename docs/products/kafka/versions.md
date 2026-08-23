# Apache Kafka 版本演进

Apache Kafka 历经从依赖 ZooKeeper 到原生 KRaft（KIP-500）元数据自管理的架构巨变，并在 3.x/4.0 完成去 ZooKeeper 的蜕变。

## 核心版本演进与关键里程碑

### Kafka 3.8（2024 年 7 月）

**主要功能与架构演进：**

- 官方 Docker 镜像（JVM 与 GraalVM Native 双版本）正式进入 GA 生产可用
- KRaft 支持更加平滑的故障恢复与分层存储（Tiered Storage）早期生产验证
- 优化次级副本读取（Fetch from Follower）机架感知调度

**工程影响与选型建议：**

> 3.x 世代去 ZooKeeper 迁移最成熟稳定的版本。

### Kafka 3.5 / 3.6（2023 年 9 月）

**主要功能与架构演进：**

- 正式将 Apache ZooKeeper 模式标记为已弃用（Deprecated）
- 引入 KRaft Migration 工具，支持生产集群在线零停机从 ZooKeeper 迁移至 KRaft

**工程影响与选型建议：**

> 确立了 KRaft 为未来唯一支持的元数据架构。

### Kafka 3.0（2021 年 9 月）

**主要功能与架构演进：**

- 正式引入基于 Raft 的原生元数据仲裁层（KRaft Mode, KIP-500），元数据作为内部 Topic 复制
- Producer 默认开启强幂等性（`enable.idempotence=true`）与全副本确认（`acks=all`）
- 彻底废弃历史已久的旧版 Scala 客户端与消息格式 v0/v1

**工程影响与选型建议：**

> 数据可靠性默认值升级与云原生架构重构里程碑。

### Kafka 2.8（2021 年 4 月）

**主要功能与架构演进：**

- 首次发布可在无 ZooKeeper 依赖下独立运行的 KRaft 早期预览版本
- 优化了连接风暴下的网络线程池调度

**工程影响与选型建议：**

> 无 ZooKeeper 架构的首次实际落地。

### Kafka 0.11（2017 年 6 月）

**主要功能与架构演进：**

- 正式引入 Exactly-Once（精确一次）投递语义支持
- 引入事务型 Producer 与两阶段提交协调器（Transaction Coordinator）
- 引入消息头（Record Headers）机制

**工程影响与选型建议：**

> 从“至少一次”迈向端到端事务一致性的关键分水岭。

## 生产从 ZooKeeper 迁移到 KRaft 实战步骤
1. 升级 Broker 与 Controller 节点二进制至 3.6+。
2. 启动专属 KRaft Controller 仲裁节点并开启双模式运行（Dual-write mode）。
3. 逐步将 Broker 迁移至 KRaft 控制，最后停用 ZooKeeper 集群。
