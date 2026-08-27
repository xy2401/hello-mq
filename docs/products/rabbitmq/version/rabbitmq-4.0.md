# RabbitMQ 4.0

> **参考官方文档**：[RabbitMQ 官方发布说明](https://www.rabbitmq.com/release-information)  
> 本页依据正式 Release 与现有仓库版本证据，整理 RabbitMQ 4.0 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2024 年 9 月
- **维护状态：** 历史版本或兼容基线；实际维护状态以官方页面为准
- **产品线：** RabbitMQ

## 核心变化

**主要功能与架构演进：**

- Khepri 元数据存储：彻底移除历史 Erlang Mnesia，改用基于 Raft 的现代化一致性元数据引擎
- 全面强化 Native MQTT 5.0 支持，单节点可支撑百万级物联网并发连接
- 正式移除已弃用的 Classic Mirrored Queues（镜像队列），强制推行 Quorum Queues 与 Streams

**工程影响与选型建议：**

> 集群元数据防脑裂与物联网吞吐质的飞跃，升级前必须完成镜像队列迁移。

## 兼容与迁移

- 核对 Broker、客户端、协议、存储格式和依赖运行时的兼容矩阵。
- 集群按官方支持的版本跨度滚动升级，先验证副本同步、消费位点和故障转移。
- 升级前保留配置与元数据备份，并确认新格式或 Feature Flag 对降级的影响。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
rabbitmqctl version
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [RabbitMQ 官方发布说明](https://www.rabbitmq.com/release-information)

资料核对日期：2026-08-27。
