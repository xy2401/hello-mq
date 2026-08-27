# NATS JetStream 版本演进

NATS JetStream 采用纯 Go 语言编写，具备超轻量、极高单机吞吐与去中心化 Raft 分布式元数据特性。

## 版本索引

### [NATS 2.14](./nats-2.14)

- **发布时间：** 2026 年 4 月
- **版本重点：** 加入 JetStream 高吞吐批量发布能力。

### [NATS 2.12](./nats-2.12)

- **发布时间：** 2025 年 9 月
- **版本重点：** 加入 Prioritized 消费策略和镜像提升能力。

### [NATS 2.10](./nats-2.10)

- **发布时间：** 2023 年 9 月
- **版本重点：** 引入存储级透明压缩与更紧凑的元数据编码，磁盘空间节省高达 60%。

### [NATS 2.2 (JetStream 正式发布)](./nats-2.2)

- **发布时间：** 2021 年 3 月
- **版本重点：** 正式推出 JetStream，全面替代历史独立的 NATS Streaming（STAN）。

## 迁移建议
- 遗留的 STAN（NATS Streaming）系统应尽快通过官方迁移工具迁移至 JetStream。
