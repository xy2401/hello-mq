# Redis 7.0 (Streams)

> **参考官方文档**：[Redis Streams 官方发布说明](https://redis.io/docs/latest/develop/whats-new/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 Redis 7.0 (Streams) 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2022 年 4 月
- **维护状态：** 历史版本或兼容基线；实际维护状态以官方页面为准
- **产品线：** Redis Streams

## 核心变化

**主要功能与架构演进：**

- 优化 Stream 内部 Radix Tree 节点的内存压缩算法与碎片清理
- 消费组支持更加平滑的挂起消息认领（XAUTOCLAIM 增强）

**工程影响与选型建议：**

> 降低海量消息消费场景下的内存占用抖动。

## 兼容与迁移

- 核对 Broker、客户端、协议、存储格式和依赖运行时的兼容矩阵。
- 集群按官方支持的版本跨度滚动升级，先验证副本同步、消费位点和故障转移。
- 升级前保留配置与元数据备份，并确认新格式或 Feature Flag 对降级的影响。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
redis-server --version
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [Redis Streams 官方发布说明](https://redis.io/docs/latest/develop/whats-new/)

资料核对日期：2026-08-27。
