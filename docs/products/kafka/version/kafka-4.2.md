# Kafka 4.2

> **参考官方文档**：[Apache Kafka 官方发布说明](https://kafka.apache.org/blog/2026/02/17/apache-kafka-4.2.0-release-announcement/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 Kafka 4.2 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2026 年 2 月
- **维护状态：** 截至 2026-08-27 的当前重要版本线
- **产品线：** Apache Kafka

## 核心变化

- Kafka Queues / Share Groups 进入生产可用阶段
- Kafka Streams 新重平衡协议进入 GA 并加入死信处理能力
- 统一 CLI 参数与指标命名，改善控制器可观测性

## 兼容与迁移

- 从 3.x 或早期 4.x 升级应先完成 KRaft 迁移并按官方跨版本路径滚动升级；核对客户端、Streams 状态和监控指标名称。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
kafka-topics.sh --version
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [Apache Kafka 官方发布说明](https://kafka.apache.org/blog/2026/02/17/apache-kafka-4.2.0-release-announcement/)

资料核对日期：2026-08-27。
