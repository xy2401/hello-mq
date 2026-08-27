# Apache Kafka 版本演进

Apache Kafka 历经从依赖 ZooKeeper 到原生 KRaft（KIP-500）元数据自管理的架构巨变，并在 3.x/4.0 完成去 ZooKeeper 的蜕变。

## 版本索引

### [Kafka 4.2](./kafka-4.2)

- **发布时间：** 2026 年 2 月
- **版本重点：** Kafka Queues / Share Groups 进入生产可用阶段。

### [Kafka 4.0](./kafka-4.0)

- **发布时间：** 2025 年 3 月
- **版本重点：** 移除 ZooKeeper 模式并以 KRaft 作为唯一元数据架构。

### [Kafka 3.8](./kafka-3.8)

- **发布时间：** 2024 年 7 月
- **版本重点：** 官方 Docker 镜像（JVM 与 GraalVM Native 双版本）正式进入 GA 生产可用。

### [Kafka 3.5 / 3.6](./kafka-3.5-3.6)

- **发布时间：** 2023 年 9 月
- **版本重点：** 正式将 Apache ZooKeeper 模式标记为已弃用（Deprecated）。

### [Kafka 3.0](./kafka-3.0)

- **发布时间：** 2021 年 9 月
- **版本重点：** 正式引入基于 Raft 的原生元数据仲裁层（KRaft Mode, KIP-500），元数据作为内部 Topic 复制。

### [Kafka 2.8](./kafka-2.8)

- **发布时间：** 2021 年 4 月
- **版本重点：** 首次发布可在无 ZooKeeper 依赖下独立运行的 KRaft 早期预览版本。

### [Kafka 0.11](./kafka-0.11)

- **发布时间：** 2017 年 6 月
- **版本重点：** 正式引入 Exactly-Once（精确一次）投递语义支持。

## 生产从 ZooKeeper 迁移到 KRaft 实战步骤
1. 升级 Broker 与 Controller 节点二进制至 3.6+。
2. 启动专属 KRaft Controller 仲裁节点并开启双模式运行（Dual-write mode）。
3. 逐步将 Broker 迁移至 KRaft 控制，最后停用 ZooKeeper 集群。
