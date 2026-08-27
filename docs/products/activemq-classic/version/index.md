# ActiveMQ Classic 版本演进

ActiveMQ Classic 5.x/6.x 是运行在无数经典企业架构中的工业级 JMS 消息系统。

## 版本索引

### [ActiveMQ Classic 6.3](./activemq-classic-6.3)

- **发布时间：** 2026 年 7 月
- **版本重点：** 进入新的 6.3 稳定系列。

### [ActiveMQ Classic 6.1](./activemq-classic-6.1)

- **发布时间：** 2024 年 4 月
- **版本重点：** 全面升级支持 Jakarta EE 10 规范（命名空间切换为 jakarta.jms.）。

### [ActiveMQ Classic 5.18](./activemq-classic-5.18)

- **发布时间：** 2023 年 3 月
- **版本重点：** 首次为 5.x 系列引入 JMS 2.0 规范的局部 API 兼容。

## 升级注意事项
- 升级至 6.x 时，需注意客户端代码引用的 JMS 命名空间由 `javax.jms` 变为 `jakarta.jms`。
