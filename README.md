# hello-mq

> **消息队列、事件流平台、可靠消息模式与横向选型 (Message Queue & Event Streaming Explorer)**

`hello-mq` 是一套面向开发者与架构师的消息队列、事件流平台和可靠消息模式文档，属于 `hello-*` 系列开源学习矩阵（已落地 `hello-lang`、`hello-sql`、`hello-mq`，`hello-shell`）：用统一实验场景解释消息系统的核心语义，用可运行的容器化 Demo 验证关键结论，并用横向矩阵说明不同产品的能力边界与选型依据。

## 核心特色

- **统一语义骨架**：所有产品按相同的十二个公共维度讲解（定位、核心实体、路由、存储、生产/消费可靠性、投递语义、顺序、失败处理、高可用、安全与可观测、限制与反模式）。
- **产品分卷**：RabbitMQ、Kafka、RocketMQ、Pulsar（P0），Redis Streams、NATS JetStream（P1），ActiveMQ Classic、ActiveMQ Artemis（P2，分卷与实验编排已就绪、日志未采集）。
- **横向矩阵**：术语映射 、投递语义、顺序与回放、重试/DLQ、事务、存储与高可用等选型维度（随产品分卷逐步落地）。
- **真实故障实验**：消费者崩溃重投、毒消息与 DLQ、幂等拦截等行为由 Docker 实验复现，并提交输出日志（`demos/<产品>/<实验>/*.out.txt`）。
- **可靠消息模式**：Outbox、幂等消费、Saga、Schema 演进（随路线推进）。

## 产品覆盖

| 产品 | 状态 | 代表性 |
| :--- | :--- | :--- |
| RabbitMQ | ✅ 已落地（8 页分卷 + 5 实验） | 传统消息队列与灵活路由 |
| Apache Kafka | ✅ 已落地（8 页分卷 + 4 实验） | 分区式持久日志与事件流 |
| Apache RocketMQ | ✅ 已落地（8 页分卷 + 4 实验） | 面向业务消息的分布式中间件 |
| Apache Pulsar | ✅ 已落地（8 页分卷 + 3 实验） | 存储计算分离、云原生多租户 |
| Redis Streams | ✅ 已落地（8 页分卷 + 2 实验） | Redis 内的追加日志与消费组 |
| NATS + JetStream | ✅ 已落地（8 页分卷 + 2 实验） | 低延迟 Core NATS 与持久化 JetStream |
| ActiveMQ Classic | 🚧 分卷进行中（P2，基础架构搭建中） | 传统 ActiveMQ：经典目的地、可靠消息模式 |
| ActiveMQ Artemis | ✅ 分卷落地（8 页 + 2 实验编排，日志未采集） | 多协议 JMS Broker：anycast/multicast、服务端重试与死信、XA 事务 |

## 目录结构

```text
hello-mq/
├── demos/              # 每个实验一个自包含目录：docker-compose.yml（完整流程）+ run.sh（收日志与断言）
│   ├── .env.versions   # 镜像版本与 digest 锁定（broker + JRE）
│   ├── .env.example    # 本地实验参数说明（演示凭据，禁止用于生产）
│   ├── shared/         # 信封、结构化日志、幂等存储、JSON Schema、fixture 与 run-common.sh
│   ├── rabbitmq/       # Java 21 Demo 主类 + 各实验目录（basic/routing/…）
│   ├── kafka/          # 同上
│   ├── rocketmq/       # 同上（含 broker.conf）
│   ├── pulsar/         # 同上
│   ├── redis-streams/  # 同上
│   ├── nats/           # 同上
│   ├── activemq-classic/       # 同上（经典目的地、可靠消息模式）
│   └── artemis/        # 同上（含 broker.xml）
├── docs/               # VitePress 文档站（首页基础、products、matrix、playground、reference）
└── scripts/            # check-project.js 静态检查
```

## 环境要求

- Node.js ≥ 20（文档站）
- Docker Engine + Docker Compose v2（实验编排）
- JDK 21+ 与 Maven 3.9+（标准 Demo；`maven.compiler.release=21`，run.sh 在 jar 缺失时自动构建）
- 建议 ≥ 4 GB 可用内存、≥ 10 GB 磁盘（单产品实验）

## 最短启动流程

```bash
npm install
npm run docs:dev          # 本地打开文档站
```

## 实验命令

每个实验目录即一次完整流程（起 broker → 生产 → 消费 → 断言 → 清理）：

```bash
bash demos/rabbitmq/basic/run.sh          # 运行单个实验（jar 缺失时自动 mvn 构建）
bash demos/kafka/ordering-replay/run.sh   # 任意产品同理
for s in demos/*/*/run.sh; do bash "$s"; done   # 全量运行
```

## 资源与安全提示

- 所有 Broker 端口仅绑定 `127.0.0.1`，不暴露公网。
- `demos/.env.example` 中的演示账号与密码**仅限本地实验，禁止用于生产**。
- run.sh 退出时自动 `docker compose down --volumes`，只作用于本实验的 `hello-mq-*` Compose Project，不使用全局 `docker prune`。
- 镜像一律 tag + digest 双锁定，禁止 `latest`；见 [版本政策](docs/reference/version-policy.md)。

## 贡献方式与证据政策

关键结论必须可追溯：产品语义引用官方文档（E1），可复现实验提供输出日志（E2）。完整规则见 [证据政策](docs/reference/evidence-policy.md)。

## License

[MIT](LICENSE)
