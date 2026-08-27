# RabbitMQ 4.3

> **参考官方文档**：[RabbitMQ 官方发布说明](https://www.rabbitmq.com/release-information)  
> 本页依据正式 Release 与现有仓库版本证据，整理 RabbitMQ 4.3 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2026 年 4 月
- **维护状态：** 截至 2026-08-27 的当前重要版本线
- **产品线：** RabbitMQ

## 核心变化

- 进入新的短周期社区支持版本线
- 延续 4.x 队列、流、元数据与运维能力演进
- 与 4.2 商业长期支持窗口并存

## 兼容与迁移

- 升级时必须逐跳遵守官方路径，先检查 Erlang/OTP 矩阵、Feature Flags、插件和队列类型。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
rabbitmqctl version
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [RabbitMQ 官方发布说明](https://www.rabbitmq.com/release-information)

资料核对日期：2026-08-27。
