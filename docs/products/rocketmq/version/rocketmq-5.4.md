# RocketMQ 5.4

> **参考官方文档**：[Apache RocketMQ 官方发布说明](https://rocketmq.apache.org/release-notes/2025/12/24/5.4.0/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 RocketMQ 5.4 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2025 年 12 月
- **维护状态：** 历史版本或兼容基线；实际维护状态以官方页面为准
- **产品线：** Apache RocketMQ

## 核心变化

- 加入优先级消息
- 基于 RocksDB 扩展定时消息、事务消息和索引实现
- 改善 POP 顺序消费与故障隔离

## 兼容与迁移

- 启用 RocksDB 路径前应验证存储资源、恢复和降级策略；客户端需匹配 5.x Proxy/gRPC 能力。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
sh mqbroker -v
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [Apache RocketMQ 官方发布说明](https://rocketmq.apache.org/release-notes/2025/12/24/5.4.0/)

资料核对日期：2026-08-27。
