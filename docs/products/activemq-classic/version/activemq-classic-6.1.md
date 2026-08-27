# ActiveMQ Classic 6.1

> **参考官方文档**：[ActiveMQ Classic 官方发布说明](https://activemq.apache.org/components/classic/download/)  
> 本页依据正式 Release 与现有仓库版本证据，整理 ActiveMQ Classic 6.1 的关键变化、兼容边界和升级检查。

## 版本定位

- **发布时间：** 2024 年 4 月
- **维护状态：** 历史版本或兼容基线；实际维护状态以官方页面为准
- **产品线：** ActiveMQ Classic

## 核心变化

**主要功能与架构演进：**

- 全面升级支持 Jakarta EE 10 规范（命名空间切换为 `jakarta.jms.*`）
- 全面要求 Java 17+ 运行环境，提升 TLS 安全套件与网络传输性能

**工程影响与选型建议：**

> 传统系统适配现代 Spring Boot 3 与 Java 17/21 的重要里程碑。

## 兼容与迁移

- 核对 Broker、客户端、协议、存储格式和依赖运行时的兼容矩阵。
- 集群按官方支持的版本跨度滚动升级，先验证副本同步、消费位点和故障转移。
- 升级前保留配置与元数据备份，并确认新格式或 Feature Flag 对降级的影响。

## 版本确认

不要根据安装包名称或容器标签推断实际版本，应在目标环境执行：

```bash
activemq --version
```

生产记录至少应包含完整版本输出、操作系统或运行时基线、架构，以及所用客户端或驱动版本。

## 官方资料

- [ActiveMQ Classic 官方发布说明](https://activemq.apache.org/components/classic/download/)

资料核对日期：2026-08-27。
