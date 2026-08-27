# Artemis 2.0

> **参考官方文档**：[ActiveMQ Artemis 官方发布说明](https://activemq.apache.org/components/artemis/download/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 Artemis 2.0 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2017 年 3 月
- **维护状态：** 历史版本或兼容基线；实际维护状态以官方页面为准
- **产品线：** ActiveMQ Artemis

## 核心变化

**主要功能与架构演进：**

- 正式确立为 Apache ActiveMQ 的下一代代码主干
- 基于 Netty 异步非阻塞事件驱动模型重构底层网络核心，吞吐比 Classic 提升一个数量级

**工程影响与选型建议：**

> 彻底重塑了 ActiveMQ 的吞吐瓶颈与协议网关能力。

## 兼容与迁移

- 核对 Broker、客户端、协议、存储格式和依赖运行时的兼容矩阵。
- 集群按官方支持的版本跨度滚动升级，先验证副本同步、消费位点和故障转移。
- 升级前保留配置与元数据备份，并确认新格式或 Feature Flag 对降级的影响。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
artemis version
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [ActiveMQ Artemis 官方发布说明](https://activemq.apache.org/components/artemis/download/)

资料核对日期：2026-08-27。
