# Pulsar 4.2

> **参考官方文档**：[Apache Pulsar 官方发布说明](https://pulsar.apache.org/contribute/release-policy/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 Pulsar 4.2 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2026 年 3 月
- **维护状态：** 截至 2026-08-27 的当前重要版本线
- **产品线：** Apache Pulsar

## 核心变化

- 延续 4.x 功能发布线并更新 Broker、客户端与依赖
- 与 4.0 LTS 并行形成短期功能版本
- 5.0 仍处于里程碑阶段，不纳入正式基线

## 兼容与迁移

- 从 4.0 LTS 进入 4.2 前应核对短支持窗口、BookKeeper、客户端和回滚路径。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
pulsar version
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [Apache Pulsar 官方发布说明](https://pulsar.apache.org/contribute/release-policy/)

资料核对日期：2026-08-27。
