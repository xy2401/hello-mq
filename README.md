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

交互回放证据需要 Docker、Compose、Bash、Maven 与 jq。每个场景使用独立 Compose Project、网络和数据卷，采集器默认同时运行 3 个场景；同一场景的步骤仍保持顺序。可用 `HELLO_MQ_COLLECT_CONCURRENCY=1..8` 调整并发数。单场景默认最多运行 600 秒，单条 Compose 命令最多运行 540 秒，可分别通过 `HELLO_MQ_SCENARIO_TIMEOUT_SECONDS` 和 `HELLO_MQ_COMPOSE_TIMEOUT_SECONDS` 调整。超时会保存当前容器状态与日志、强制终止 Compose Project，并继续汇总其他场景。普通文档构建不会启动 Broker：

```bash
npm run collect:playground
npm run collect:playground -- --product rabbitmq
npm run collect:playground -- --scenario rabbitmq/consumer-crash
npm run check:playground:structure  # 只检查采集与页面基础设施
npm run check:playground            # 要求 11 个场景全部已有已验证快照
```

## 资源与安全提示

- 交互回放场景不向宿主机发布 Broker 端口；需要宿主机 CLI 的独立 Docker 验证只绑定 `127.0.0.1`，不暴露公网。
- `demos/.env.example` 中的演示账号与密码**仅限本地实验，禁止用于生产**。
- run.sh 退出时自动 `docker compose down --volumes`，只作用于本实验的 `hello-mq-*` Compose Project，不使用全局 `docker prune`。
- 镜像一律 tag + digest 双锁定，禁止 `latest`；见 [版本政策](docs/reference/version-policy.md)。

## 贡献方式与证据政策

关键结论必须可追溯：产品语义引用官方文档（E1），可复现实验提供输出日志（E2）。完整规则见 [证据政策](docs/reference/evidence-policy.md)。

## 容器命令与完整文件数据

RabbitMQ 新入口：[容器内命令](docs/products/rabbitmq/docker-commands.md)、[命令示例与结果](docs/products/rabbitmq/docker-command-ops.md)。新采集固定 Ubuntu 26.04 / RabbitMQ 4.1.4，Erlang 27.3.4.3 单独归依赖阶段；旧页面保留原环境证据。

完整文件清单、安装锁和采集历史归 [Hello Docker](https://github.com/xy2401/hello-docker/blob/main/docs/support/software-capture.md) 管理。本站只保存导入并校验过的 `docs/public/docker-data/rabbitmq/` 展示包，构建不读取相邻仓库。初始 `pending` 包只有计划命令及案例，不代表已经运行。

## Cloudflare Workers 部署

仓库根目录的 [wrangler.jsonc](wrangler.jsonc) 声明了构建命令和静态资源目录。Wrangler 在部署阶段执行 `npm run docs:build`，随后发布 `docs/.vitepress/dist`；页面使用静态 HTML 路由和 VitePress 的 404 页面。

在 Cloudflare Workers 中导入本仓库，Worker 名称使用 `hello-mq`（与配置中的 `name` 一致），根目录使用仓库根目录，**构建命令留空**，部署命令保留默认的 `npx wrangler deploy`。构建环境使用 Node.js 22.16+，站点默认部署到域名根路径 `/`，无需设置 `DOCS_BASE`。

构建命令由 Wrangler 执行，不依赖控制台自动填充构建命令字段。配置方式见 [Wrangler 自定义构建](https://developers.cloudflare.com/workers/wrangler/custom-builds/)和 [Workers 静态站点路由](https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/)。

## License

[MIT](LICENSE)
