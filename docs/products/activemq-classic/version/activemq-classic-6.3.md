# ActiveMQ Classic 6.3

> **参考官方文档**：[ActiveMQ Classic 官方发布说明](https://activemq.apache.org/components/classic/download/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 ActiveMQ Classic 6.3 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2026 年 7 月
- **维护状态：** 截至 2026-08-27 的当前重要版本线
- **产品线：** ActiveMQ Classic

## 核心变化

- 进入新的 6.3 稳定系列
- 保持 Jakarta Messaging 2/3.1 客户端方向并更新 Spring、Jetty 等运行时依赖
- 支持 Java 17、21、25 的明确组合

## 兼容与迁移

- 升级 Broker 前核对 OpenWire 客户端、KahaDB、插件和 Java 基线；5.x 的 javax JMS 应用不能只靠替换 Broker 推断兼容。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
activemq --version
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [ActiveMQ Classic 官方发布说明](https://activemq.apache.org/components/classic/download/)

资料核对日期：2026-08-27。
