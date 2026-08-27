# Pulsar 4.0 LTS

> **参考官方文档**：[Apache Pulsar 官方发布说明](https://pulsar.apache.org/release-notes/versioned/pulsar-4.0.0/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 Pulsar 4.0 LTS 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2024 年 10 月
- **维护状态：** 历史版本或兼容基线；实际维护状态以官方页面为准
- **产品线：** Apache Pulsar

## 核心变化

- 增强 Key_Shared、QoS 与多租户资源管理
- 官方容器切换到 Java 21 与 Alpine 基线
- 成为新的两年社区维护 LTS 线

## 兼容与迁移

- 从 3.x 升级时应先更新受漏洞影响的 Java 客户端，并分别验证 Broker、BookKeeper、Functions 和 Connector。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
pulsar version
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [Apache Pulsar 官方发布说明](https://pulsar.apache.org/release-notes/versioned/pulsar-4.0.0/)

资料核对日期：2026-08-27。
