# RabbitMQ 4.2

> **参考官方文档**：[RabbitMQ 官方发布说明](https://www.rabbitmq.com/release-information)  
> 本页依据正式 Release 与现有仓库版本证据，整理 RabbitMQ 4.2 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2025 年
- **维护状态：** 历史版本或兼容基线；实际维护状态以官方页面为准
- **产品线：** RabbitMQ

## 核心变化

- 成为 4.x 的重要维护和商业长期支持系列
- 继续改进 Quorum Queues、Streams、AMQP 1.0 与可观测性
- 更新 Erlang/OTP 与插件兼容边界

## 兼容与迁移

- 从 3.13 或 4.0 升级前启用全部稳定 Feature Flags，并核对集群混合版本窗口。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
rabbitmqctl version
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [RabbitMQ 官方发布说明](https://www.rabbitmq.com/release-information)

资料核对日期：2026-08-27。
