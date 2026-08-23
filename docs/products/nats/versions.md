# NATS JetStream 版本演进

NATS JetStream 采用纯 Go 语言编写，具备超轻量、极高单机吞吐与去中心化 Raft 分布式元数据特性。

## 核心版本演进与关键里程碑

### NATS 2.10（2023 年 9 月）

**主要功能与架构演进：**

- 引入存储级透明压缩与更紧凑的元数据编码，磁盘空间节省高达 60%
- 支持细粒度 Subject 过滤与去重窗口多维度控制

**工程影响与选型建议：**

> 边缘计算与大规模高吞吐消息系统的最新稳健基线。

### NATS 2.2 (JetStream 正式发布)（2021 年 3 月）

**主要功能与架构演进：**

- 正式推出 JetStream，全面替代历史独立的 NATS Streaming（STAN）
- 将持久化、流式回溯与 Key-Value / Object Store 功能完全融入 NATS Server 单一内核中

**工程影响与选型建议：**

> NATS 生态划时代的架构统一与轻量化升级。

## 迁移建议
- 遗留的 STAN（NATS Streaming）系统应尽快通过官方迁移工具迁移至 JetStream。
