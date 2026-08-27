# NATS 2.12

> **参考官方文档**：[NATS JetStream 官方发布说明](https://nats.io/blog/nats-server-2.12-release/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 NATS 2.12 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2025 年 9 月
- **维护状态：** 历史版本或兼容基线；实际维护状态以官方页面为准
- **产品线：** NATS JetStream

## 核心变化

- 加入 Prioritized 消费策略和镜像提升能力
- 通过 offline assets 保护降级时的新格式资产
- 建立更可预测的半年发布节奏

## 兼容与迁移

- 若可能降级到 2.11，应至少使用能识别新资产的 2.11.9，并先验证 JetStream 元数据。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
nats-server --version
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [NATS JetStream 官方发布说明](https://nats.io/blog/nats-server-2.12-release/)

资料核对日期：2026-08-27。
