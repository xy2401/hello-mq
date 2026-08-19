# 产品分卷

> 六个产品各有一卷 8 页的讲解，全部按同一套公共维度展开：总览、快速开始、核心概念映射、路由/分发、可靠性、存储与高可用、运维与观测、陷阱与检查表。先读[基础原理](/fundamentals/)再进分卷，或直接用[横向矩阵](/matrix/)做比较。

| 产品 | 定位 | 实验 | 入口 |
| :--- | :--- | :--- | :--- |
| <ProductLogo product="rabbitmq" /> **RabbitMQ** | 传统消息队列与灵活路由（Exchange/Binding、两段确认） | 5 个 | [进入分卷](/brokers/rabbitmq/) |
| <ProductLogo product="kafka" /> **Apache Kafka** | 分区式持久日志与事件流（KRaft、消费组、事务） | 4 个 | [进入分卷](/brokers/kafka/) |
| <ProductLogo product="rocketmq" /> **Apache RocketMQ** | 面向业务消息的中间件（消息类型、内置重试、事务回查、定时消息） | 4 个 | [进入分卷](/brokers/rocketmq/) |
| <ProductLogo product="pulsar" /> **Apache Pulsar** | 存储计算分离、云原生多租户（BookKeeper、四订阅类型） | 3 个 | [进入分卷](/brokers/pulsar/) |
| <ProductLogo product="redis" /> **Redis Streams** | Redis 内的追加日志与消费组（PEL、XCLAIM、轻量可靠队列） | 2 个 | [进入分卷](/brokers/redis-streams/) |
| <ProductLogo product="nats" /> **NATS + JetStream** | 低延迟连接总线（Core）+ 内建持久事件流（JetStream） | 2 个 | [进入分卷](/brokers/nats/) |

## 怎么读每一卷

1. **总览**：定位、架构速览、与同类产品的差异一句话。
2. **快速开始**：本仓库 `npm run lab` 的最短复现路径。
3. **核心概念映射**：中性术语 → 该产品术语，读横向矩阵前先对齐。
4. **路由/可靠性/存储**：三层语义（Broker / Client / Business）拆开讲「保证」成立的条件。
5. **陷阱与检查表**：该产品的禁止表述与上线前逐项核对。

前四个为 P0 核心产品（实验与快照更完整），Redis Streams 与 NATS 为 P1 轻量扩展（精简实验覆盖核心语义，见规格 §3.2）。
