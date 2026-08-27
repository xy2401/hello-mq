# RabbitMQ 版本演进

RabbitMQ 采用大版本演进。4.0 标志着元数据层由历史 Mnesia 全面重构为基于 Raft 的 Khepri，高可用队列也由传统镜像队列全面转向 Quorum Queues。

## 版本索引

### [RabbitMQ 4.3](./rabbitmq-4.3)

- **发布时间：** 2026 年 4 月
- **版本重点：** 进入新的短周期社区支持版本线。

### [RabbitMQ 4.2](./rabbitmq-4.2)

- **发布时间：** 2025 年
- **版本重点：** 成为 4.x 的重要维护和商业长期支持系列。

### [RabbitMQ 4.0](./rabbitmq-4.0)

- **发布时间：** 2024 年 9 月
- **版本重点：** Khepri 元数据存储：彻底移除历史 Erlang Mnesia，改用基于 Raft 的现代化一致性元数据引擎。

### [RabbitMQ 3.13](./rabbitmq-3.13)

- **发布时间：** 2024 年 2 月
- **版本重点：** Stream 队列服务侧端到端消息过滤，无需客户端拉取全量日志。

### [RabbitMQ 3.12](./rabbitmq-3.12)

- **发布时间：** 2023 年 6 月
- **版本重点：** 显著优化 Quorum Queues 磁盘写入吞吐与内存回收效率。

### [RabbitMQ 3.8](./rabbitmq-3.8)

- **发布时间：** 2019 年 10 月
- **版本重点：** 正式引入 Quorum Queues（仲裁队列）：基于 Raft 分布式共识算法解决网络分区脑裂问题。

## 生产升级检查清单
1. **镜像队列迁移**：升级到 4.0 前，必须使用 `rabbitmq-queues migrate classic_to_quorum` 将所有 Mirrored Queues 迁移为 Quorum Queues。
2. **Erlang/OTP 兼容性**：核对目标版本所需的最低 Erlang 运行时版本（如 RabbitMQ 4.0 要求 Erlang 26+）。
