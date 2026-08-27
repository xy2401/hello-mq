# Kafka 3.0

> **参考官方文档**：[Apache Kafka 官方发布说明](https://kafka.apache.org/community/downloads/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 Kafka 3.0 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2021 年 9 月
- **维护状态：** 历史版本或兼容基线；实际维护状态以官方页面为准
- **产品线：** Apache Kafka

## 核心变化

**主要功能与架构演进：**

- 正式引入基于 Raft 的原生元数据仲裁层（KRaft Mode, KIP-500），元数据作为内部 Topic 复制
- Producer 默认开启强幂等性（`enable.idempotence=true`）与全副本确认（`acks=all`）
- 彻底废弃历史已久的旧版 Scala 客户端与消息格式 v0/v1

**工程影响与选型建议：**

> 数据可靠性默认值升级与云原生架构重构里程碑。

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
