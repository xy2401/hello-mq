# Kafka 4.0

> **参考官方文档**：[Apache Kafka 官方发布说明](https://kafka.apache.org/community/downloads/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 Kafka 4.0 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2025 年 3 月
- **维护状态：** 历史版本或兼容基线；实际维护状态以官方页面为准
- **产品线：** Apache Kafka

## 核心变化

- 移除 ZooKeeper 模式并以 KRaft 作为唯一元数据架构
- 提高 Java 基线并清理长期弃用 API
- 开启新的 Broker、客户端与 Streams 兼容主线

## 兼容与迁移

- 不能从仍依赖 ZooKeeper 的集群直接替换二进制；必须先在 3.x 完成受支持的 KRaft 迁移。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
kafka-topics.sh --version
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [Apache Kafka 官方发布说明](https://kafka.apache.org/community/downloads/)

资料核对日期：2026-08-27。
