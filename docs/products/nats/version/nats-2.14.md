# NATS 2.14

> **参考官方文档**：[NATS JetStream 官方发布说明](https://nats.io/blog/nats-server-2.14-release/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 NATS 2.14 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2026 年 4 月
- **维护状态：** 截至 2026-08-27 的当前重要版本线
- **产品线：** NATS JetStream

## 核心变化

- 加入 JetStream 高吞吐批量发布能力
- 扩展服务器端消息调度
- 修正 Interest 与 WorkQueue 流的 source/mirror 一致性

## 兼容与迁移

- 滚动升级前检查 JetStream 资产、镜像、source 和客户端库；降级时确认新资产是否会进入 offline 状态。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
nats-server --version
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [NATS JetStream 官方发布说明](https://nats.io/blog/nats-server-2.14-release/)

资料核对日期：2026-08-27。
