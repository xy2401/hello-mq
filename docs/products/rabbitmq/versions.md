# RabbitMQ 版本演进

RabbitMQ 采用大版本演进。4.0 标志着元数据层由历史 Mnesia 全面重构为基于 Raft 的 Khepri，高可用队列也由传统镜像队列全面转向 Quorum Queues。

## 核心版本演进与关键里程碑

### RabbitMQ 4.0（2024 年 9 月）

**主要功能与架构演进：**

- Khepri 元数据存储：彻底移除历史 Erlang Mnesia，改用基于 Raft 的现代化一致性元数据引擎
- 全面强化 Native MQTT 5.0 支持，单节点可支撑百万级物联网并发连接
- 正式移除已弃用的 Classic Mirrored Queues（镜像队列），强制推行 Quorum Queues 与 Streams

**工程影响与选型建议：**

> 集群元数据防脑裂与物联网吞吐质的飞跃，升级前必须完成镜像队列迁移。

### RabbitMQ 3.13（2024 年 2 月）

**主要功能与架构演进：**

- Stream 队列服务侧端到端消息过滤，无需客户端拉取全量日志
- Classic Queues v2 成为默认引擎，内存占用显著低于旧版 CQv1
- 增强 Prometheus 细粒度指标与 TLS 1.3 支持

**工程影响与选型建议：**

> 3.x 系列的终极成熟维护线，作为迁往 4.0 的过渡基准。

### RabbitMQ 3.12（2023 年 6 月）

**主要功能与架构演进：**

- 显著优化 Quorum Queues 磁盘写入吞吐与内存回收效率
- 支持基于 OAuth 2.0 / OpenID Connect 的企业级单点鉴权与授权

**工程影响与选型建议：**

> Quorum Queues 大规模生产应用的成熟里程碑。

### RabbitMQ 3.8（2019 年 10 月）

**主要功能与架构演进：**

- 正式引入 Quorum Queues（仲裁队列）：基于 Raft 分布式共识算法解决网络分区脑裂问题
- 原生内置 Prometheus & Grafana 监控插件，替代旧版高负载 Management UI 轮询

**工程影响与选型建议：**

> 彻底改变了 RabbitMQ 高可用架构的技术路线。

## 生产升级检查清单
1. **镜像队列迁移**：升级到 4.0 前，必须使用 `rabbitmq-queues migrate classic_to_quorum` 将所有 Mirrored Queues 迁移为 Quorum Queues。
2. **Erlang/OTP 兼容性**：核对目标版本所需的最低 Erlang 运行时版本（如 RabbitMQ 4.0 要求 Erlang 26+）。
