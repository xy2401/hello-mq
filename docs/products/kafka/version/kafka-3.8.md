# Kafka 3.8

> **参考官方文档**：[Apache Kafka 官方发布说明](https://kafka.apache.org/community/downloads/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 Kafka 3.8 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2024 年 7 月
- **维护状态：** 历史版本或兼容基线；实际维护状态以官方页面为准
- **产品线：** Apache Kafka

## 核心变化

**主要功能与架构演进：**

- 官方 Docker 镜像（JVM 与 GraalVM Native 双版本）正式进入 GA 生产可用
- KRaft 支持更加平滑的故障恢复与分层存储（Tiered Storage）早期生产验证
- 优化次级副本读取（Fetch from Follower）机架感知调度

**工程影响与选型建议：**

> 3.x 世代去 ZooKeeper 迁移最成熟稳定的版本。

## 兼容与迁移

- 核对 Broker、客户端、协议、存储格式和依赖运行时的兼容矩阵。
- 集群按官方支持的版本跨度滚动升级，先验证副本同步、消费位点和故障转移。
- 升级前保留配置与元数据备份，并确认新格式或 Feature Flag 对降级的影响。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
kafka-topics.sh --version
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [Apache Kafka 官方发布说明](https://kafka.apache.org/community/downloads/)

资料核对日期：2026-08-27。
