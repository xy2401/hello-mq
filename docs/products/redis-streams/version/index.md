# Redis Streams 版本演进

Redis Streams 从 Redis 5.0 开始引入，为轻量级微服务架构提供了基于内存、具备消费组与 ACK 确认机制的极速流处理组件。

## 版本索引

### [Redis 8.x Streams](./redis-8.x-streams)

- **发布时间：** 2025–2026 年
- **版本重点：** Streams 随 Redis 8 统一发行包和双月功能节奏演进。

### [Redis 7.0 (Streams)](./redis-7.0)

- **发布时间：** 2022 年 4 月
- **版本重点：** 优化 Stream 内部 Radix Tree 节点的内存压缩算法与碎片清理。

### [Redis 6.2 (Streams)](./redis-6.2)

- **发布时间：** 2021 年 2 月
- **版本重点：** 引入 XAUTOCLAIM 命令：一条命令自动扫描并转移消费超时的挂起消息，极大简化死信重试逻辑。

### [Redis 5.0 (Streams 诞生)](./redis-5.0)

- **发布时间：** 2018 年 10 月
- **版本重点：** 正式引入全新的 Stream 核心数据结构。

## 生产建议
- 写入 Stream 时必须搭配 `MAXLEN ~ N` 或 `MINID` 修剪历史，避免未限制的内存无限膨胀。
