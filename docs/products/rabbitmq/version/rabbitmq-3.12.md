# RabbitMQ 3.12

> **参考官方文档**：[RabbitMQ 官方发布说明](https://www.rabbitmq.com/release-information)  
> 本页依据正式 Release 与现有仓库版本证据，整理 RabbitMQ 3.12 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2023 年 6 月
- **维护状态：** 历史版本或兼容基线；实际维护状态以官方页面为准
- **产品线：** RabbitMQ

## 核心变化

**主要功能与架构演进：**

- 显著优化 Quorum Queues 磁盘写入吞吐与内存回收效率
- 支持基于 OAuth 2.0 / OpenID Connect 的企业级单点鉴权与授权

**工程影响与选型建议：**

> Quorum Queues 大规模生产应用的成熟里程碑。

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
