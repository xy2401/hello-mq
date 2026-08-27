# Redis 8.x Streams

> **参考官方文档**：[Redis Streams 官方发布说明](https://redis.io/docs/latest/develop/whats-new/redis-feature-sets/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 Redis 8.x Streams 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2025–2026 年
- **维护状态：** 截至 2026-08-27 的当前重要版本线
- **产品线：** Redis Streams

## 核心变化

- Streams 随 Redis 8 统一发行包和双月功能节奏演进
- `XREAD` 增加从最后一条消息开始读取的 `+` ID 等能力
- Search、JSON、Time Series 等能力与 Streams 可在同一发行包使用

## 兼容与迁移

- 升级消费者组前检查命令语义、ACL、持久化与复制；不要把 8.x 功能版本当成纯补丁升级。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
redis-server --version
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [Redis Streams 官方发布说明](https://redis.io/docs/latest/develop/whats-new/redis-feature-sets/)

资料核对日期：2026-08-27。
