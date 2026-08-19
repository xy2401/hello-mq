# hello-mq

> **消息队列、事件流平台、可靠消息模式与横向选型知识库 (Message Queue & Event Streaming Explorer)**

`hello-mq` 是一套面向开发者与架构师的消息队列、事件流平台和可靠消息模式知识库：用统一实验场景解释消息系统的核心语义，用可运行的容器化 Demo 验证关键结论，并用横向矩阵说明不同产品的能力边界与选型依据。

## 核心特色

- **统一语义骨架**：所有产品按相同的十二个公共维度讲解（定位、核心实体、路由、存储、生产/消费可靠性、投递语义、顺序、失败处理、高可用、安全与可观测、限制与反模式）。
- **产品分卷**：RabbitMQ、Kafka、RocketMQ、Pulsar（P0），Redis Streams、NATS JetStream（P1），ActiveMQ Artemis（P2，分卷与实验编排已就绪、快照未采集）。
- **横向矩阵**：术语映射 、投递语义、顺序与回放、重试/DLQ、事务、存储与高可用等选型维度（随产品分卷逐步落地）。
- **真实故障实验**：消费者崩溃重投、毒消息与 DLQ、幂等拦截等行为由 Docker 实验复现，并提交归一化验证快照。
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
| ActiveMQ Artemis | ✅ 分卷落地（8 页 + 2 实验编排，快照未采集） | 多协议 JMS Broker：anycast/multicast、服务端重试与死信、XA 事务 |

## 目录结构

```text
hello-mq/
├── compose/            # 各产品 Docker Compose（镜像 tag+digest 双锁定）
├── demos/              # Java 21 标准 Demo（Maven 多模块）与统一消息契约
│   ├── shared/         # 信封、结构化日志、幂等存储、JSON Schema 与 fixture
│   ├── rabbitmq/       # RabbitMQ 实验主类与实验注册表
│   ├── kafka/          # Kafka 实验主类与实验注册表
│   ├── rocketmq/       # RocketMQ 实验主类与实验注册表
│   ├── pulsar/         # Pulsar 实验主类与实验注册表
│   ├── redis-streams/  # Redis Streams 实验主类与实验注册表
│   ├── nats/           # NATS（Core + JetStream）实验主类与实验注册表
│   └── artemis/        # ActiveMQ Artemis 实验主类与实验注册表
├── docs/               # VitePress 文档站（guide/fundamentals/brokers/labs/...）
├── outputs/            # 已验证实验快照（归一化后提交）
├── scripts/            # lab.js 实验入口与静态检查
├── .env.versions       # 镜像版本与 digest 锁定
└── hello-mq-spec.md    # 项目规格说明书
```

## 环境要求

- Node.js ≥ 20（文档站与实验入口）
- Docker Engine + Docker Compose v2（Broker 实验）
- JDK 21+ 与 Maven 3.9+（标准 Demo；`maven.compiler.release=21`）
- 建议 ≥ 4 GB 可用内存、≥ 10 GB 磁盘（单产品实验）

## 最短启动流程

```bash
npm install
npm run docs:dev          # 本地打开文档站
```

## 单产品实验命令

```bash
npm run lab -- list                 # 列出全部产品与实验
npm run lab -- rabbitmq basic       # 运行单个实验
npm run lab -- rabbitmq all         # 运行某产品全部 L1/L2 实验
npm run verify-outputs              # 核验已提交快照
npm run lab -- rabbitmq clean       # 仅清理该产品实验资源
```

## 资源与安全提示

- 所有 Broker 端口仅绑定 `127.0.0.1`，不暴露公网。
- `.env.example` 中的演示账号与密码**仅限本地实验，禁止用于生产**。
- 实验清理只作用于 `hello-mq-*` Compose Project，不使用全局 `docker prune`。
- 镜像一律 tag + digest 双锁定，禁止 `latest`；见 [版本政策](docs/reference/version-policy.md)。

## 贡献方式与证据政策

关键结论必须可追溯：产品语义引用官方文档（E1），可复现实验提供归一化快照（E2）。完整规则见 [证据政策](docs/reference/evidence-policy.md)。

## License

[MIT](LICENSE)
