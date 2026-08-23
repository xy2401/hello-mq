# ActiveMQ Classic 版本演进

ActiveMQ Classic 5.x/6.x 是运行在无数经典企业架构中的工业级 JMS 消息系统。

## 核心版本演进与关键里程碑

### ActiveMQ Classic 6.1（2024 年 4 月）

**主要功能与架构演进：**

- 全面升级支持 Jakarta EE 10 规范（命名空间切换为 `jakarta.jms.*`）
- 全面要求 Java 17+ 运行环境，提升 TLS 安全套件与网络传输性能

**工程影响与选型建议：**

> 传统系统适配现代 Spring Boot 3 与 Java 17/21 的重要里程碑。

### ActiveMQ Classic 5.18（2023 年 3 月）

**主要功能与架构演进：**

- 首次为 5.x 系列引入 JMS 2.0 规范的局部 API 兼容
- 支持在 JDK 11 与 JDK 17 上稳定运行

**工程影响与选型建议：**

> 5.x 系列老系统的终极维护分支。

## 升级注意事项
- 升级至 6.x 时，需注意客户端代码引用的 JMS 命名空间由 `javax.jms` 变为 `jakarta.jms`。
