# RocketMQ 5.5

> **参考官方文档**：[Apache RocketMQ 官方发布说明](https://rocketmq.apache.org/download/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 RocketMQ 5.5 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2026 年 4 月
- **维护状态：** 截至 2026-08-27 的当前重要版本线
- **产品线：** Apache RocketMQ

## 核心变化

- 延续 5.x Proxy、gRPC 与云原生架构演进
- 汇总优先级消息、RocksDB 存储等后续能力
- 更新 Broker、Proxy 与客户端组合

## 兼容与迁移

- 升级时分别核对 NameServer、Broker、Proxy、客户端和存储格式，先按官方顺序完成滚动验证。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
sh mqbroker -v
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [Apache RocketMQ 官方发布说明](https://rocketmq.apache.org/download/)

资料核对日期：2026-08-27。
