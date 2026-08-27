# Redis 5.0 (Streams 诞生)

> **参考官方文档**：[Redis Streams 官方发布说明](https://redis.io/docs/latest/develop/whats-new/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 Redis 5.0 (Streams 诞生) 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2018 年 10 月
- **维护状态：** 历史版本或兼容基线；实际维护状态以官方页面为准
- **产品线：** Redis Streams

## 核心变化

**主要功能与架构演进：**

- 正式引入全新的 Stream 核心数据结构
- 原生支持持久化消息追加（XADD）、范围读取（XRANGE）、阻塞拉取（XREAD）
- 引入消费组模型（XGROUP）、挂起消息列表（PEL）与确认机制（XACK）

**工程影响与选型建议：**

> 彻底弥补了 Redis Pub/Sub 消息不持久、无法回溯与无法负载均衡的缺陷。

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
