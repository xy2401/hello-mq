# Apache RocketMQ 版本演进

Apache RocketMQ 5.0 实现了向云原生、无状态计算与轻量 gRPC 客户端的架构重构。

## 版本索引

### [RocketMQ 5.5](./rocketmq-5.5)

- **发布时间：** 2026 年 4 月
- **版本重点：** 延续 5.x Proxy、gRPC 与云原生架构演进。

### [RocketMQ 5.4](./rocketmq-5.4)

- **发布时间：** 2025 年 12 月
- **版本重点：** 加入优先级消息。

### [RocketMQ 5.3](./rocketmq-5.3)

- **发布时间：** 2024 年 8 月
- **版本重点：** 正式推出分层存储（Tiered Storage）生产级支持，冷数据自动沉降至 S3/OSS 等对象存储。

### [RocketMQ 5.0](./rocketmq-5.0)

- **发布时间：** 2022 年 9 月
- **版本重点：** 计算与存储分离架构：引入无状态 Stateless Proxy 节点，承接多语言与 gRPC 请求。

### [RocketMQ 4.5](./rocketmq-4.5)

- **发布时间：** 2019 年 4 月
- **版本重点：** 引入 DLedger 存储组件：基于 Raft 协议实现 CommitLog 多副本自动选主与数据同步。

## 5.0 架构升级建议
- 新项目推荐直接部署 5.x 架构（NameServer + Broker + Proxy），并采用基于 gRPC 的新版客户端驱动。
