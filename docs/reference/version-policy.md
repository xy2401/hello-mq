# 版本政策

> 本页结论：所有 Broker 镜像与客户端依赖一律 tag + digest 双锁定，禁止浮动标签；升级走独立流程并刷新快照。

## 锁定规则

- 不使用 `latest`、`edge`、`nightly` 等浮动标签。
- `.env.versions` 同时记录镜像 Tag 与多架构 index Digest：

```dotenv
RABBITMQ_IMAGE=rabbitmq:4.1.4-management@sha256:<digest>
```

- Compose 文件只写 `image: ${RABBITMQ_IMAGE}`，由各实验的 `docker compose --env-file ../.env.versions` 注入。
- Digest 必须用 `docker buildx imagetools inspect <image>:<tag>` 实测获取并记录，禁止凭记忆抄写。
- Java 客户端版本锁在 `demos/pom.xml` 的 `dependencyManagement` 中。

## 当前锁定版本

| 组件 | 版本 | 核对日期 | 说明 |
| :--- | :--- | :--- | :--- |
| RabbitMQ 镜像 | `rabbitmq:4.1.4-management` | 2026-08-19 | 官方仍支持的 4.1.x 线，management 插件提供 UI 与 HTTP API（checkedAt: 2026-08-19，来源见[官方资料基线](/reference/sources)） |
| amqp-client | 5.34.0 | 2026-08-19 | RabbitMQ 官方 Java 客户端 |
| Kafka 镜像 | `apache/kafka:4.3.1` | 2026-08-19 | 官方 KRaft 镜像，单进程 broker+controller（checkedAt: 2026-08-19，来源见[官方资料基线](/reference/sources)） |
| kafka-clients | 4.3.1 | 2026-08-19 | 与 Broker 同版本线 |
| RocketMQ 镜像 | `apache/rocketmq:5.5.0` | 2026-08-19 | 官方镜像，namesrv/broker/proxy 三服务编排（checkedAt: 2026-08-19，来源见[官方资料基线](/reference/sources)） |
| rocketmq-client-java | 5.2.0 | 2026-08-19 | 5.x gRPC 客户端，经 proxy 8081 接入 |
| Pulsar 镜像 | `apachepulsar/pulsar:4.2.4` | 2026-08-19 | standalone 单容器（broker + BookKeeper + 元数据内嵌）（checkedAt: 2026-08-19，来源见[官方资料基线](/reference/sources)） |
| pulsar-client | 4.2.2 | 2026-08-19 | 与 Broker 同 4.2.x 版本线 |
| JDK（字节码目标） | 21 | 2026-08-19 | `maven.compiler.release=21`；本地可用更高版本 JDK 编译 |
| Temurin JRE 镜像 | `eclipse-temurin:21-jre` | 2026-08-20 | compose 内 producer/consumer 等 Java 服务的基础镜像（checkedAt: 2026-08-20） |

## 升级流程

1. 在独立分支更新 `.env.versions` 的 tag 与 digest（实测获取）。
2. 更新客户端依赖版本并确认编译与单测通过。
3. 重跑相关实验（`bash demos/<产品>/<实验>/run.sh`）刷新输出日志。
4. 审查日志语义变化（断言数值、日志形态），再修改文档结论。
5. “当前最新”“默认值”等时效性表述必须更新核对日期。

## 审查节奏

- 每季度检查官方支持版本；发生安全问题时立即检查。
- 过时内容优先标记 `VersionBadge`/核对日期，而不是静默删除结论。
