# 安全矩阵

> 本页结论：七个产品都支持 TLS 传输加密与账号级认证授权，但粒度与形态不同——RabbitMQ 按 vhost 内资源正则授权，Kafka 用 ACL 到 topic/group，RocketMQ 提供 ACL 访问控制，Pulsar 在 Tenant/Namespace 层级做多租户授权，Redis 用 ACL 到命令/键模式级别，NATS 按 Account + Subject 权限授权，Artemis 按角色 × 地址（security-settings）授权；静态加密普遍需要存储层配合（NATS JetStream 可配置静态加密密钥），审计能力普遍需要额外组件或平台配合。

覆盖 spec §8.2「运维矩阵」中安全能力部分（工具/指标/Schema 部分见[运维观测](/matrix/operations)）。版本基线与标记规则见[矩阵总览](/matrix/)（checkedAt: 2026-08-19）。安全基线的完整要求见 spec §12.3（TLS、最小授权、秘密管理、端口分离、Payload 脱敏）。

## 加密

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 传输加密（TLS） | ✅ AMQPS/STOMP over TLS 等，支持服务端证书校验与双向 TLS（[operations](/brokers/rabbitmq/operations)） | ✅ 客户端与 Broker、Broker 间均可 TLS/SASL_SSL（[operations](/brokers/kafka/operations)） | ✅ 客户端与 Broker 间 TLS（[operations](/brokers/rocketmq/operations)） | ✅ 客户端、Broker 间、Broker 与 BookKeeper 间均可 TLS（[operations](/brokers/pulsar/operations)） | ✅ 原生 TLS 端口（6379 可配 TLS），支持双向证书校验（[operations](/brokers/redis-streams/operations)） | ✅ 客户端与服务器间 TLS，集群路由亦走 TLS（[operations](/brokers/nats/operations)） | ✅ acceptor 配置 SSL_ENABLED：AMQP/CORE/STOMP 等多协议均可走 TLS（[operations](/brokers/artemis/operations)） |
| 静态加密（存储层） | ➖ 无内置：依赖磁盘/文件系统层加密（[pitfalls](/brokers/rabbitmq/pitfalls)） | ➖ 无内置：依赖存储层加密方案（[pitfalls](/brokers/kafka/pitfalls)） | ➖ 无内置：依赖磁盘层加密（[pitfalls](/brokers/rocketmq/pitfalls)） | ➖ Broker 侧无内置静态加密：依赖 BookKeeper 存储层/磁盘加密；内容保护可改用消息级端到端加密（[storage-ha](/brokers/pulsar/storage-ha)） | ➖ 无内置：RDB/AOF 文件依赖磁盘层加密（[pitfalls](/brokers/redis-streams/pitfalls)） | 🔧 JetStream 支持配置静态加密密钥（服务端配置 key，落盘数据加密）（[operations](/brokers/nats/operations)） | ➖ 无内置：journal 文件依赖磁盘层加密（[pitfalls](/brokers/artemis/pitfalls)） |
| 消息级端到端加密 | ➖ 无内置 | ➖ 无内置（可在应用层字段加密） | ➖ 无内置 | ✅ 客户端级消息加密（producer 加密 / consumer 解密，Broker 不见明文），需配置加密密钥（[reliability](/brokers/pulsar/reliability)） | ➖ 无内置 | ➖ 无内置（可在应用层字段加密） | ➖ 无内置（可在应用层字段加密） |

> 「传输加密、静态加密、应用层字段加密」是三个不同边界：TLS 只保护链路，磁盘加密只保护介质，字段加密才保护消息内容本身。三者不可互相替代。

## 认证与授权

| 能力 | RabbitMQ | Kafka | RocketMQ | Pulsar | Redis Streams | NATS | Artemis |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 认证机制 | ✅ 内置用户名/密码（SASL PLAIN）、客户端证书（EXTERNAL）等（[operations](/brokers/rabbitmq/operations)） | ✅ SASL 多机制（PLAIN/SCRAM/KERBEROS/OAUTHBEARER）（[operations](/brokers/kafka/operations)） | ✅ ACL 账号体系（AccessKey/SecretKey）（[operations](/brokers/rocketmq/operations)） | ✅ 可插拔认证：JWT token、TLS 证书、OIDC 等（[operations](/brokers/pulsar/operations)） | ✅ ACL 用户名/密码、客户端证书、AUTH 命令（[operations](/brokers/redis-streams/operations)） | ✅ 多机制：token、用户名密码、NKeys、JWT（账号体系）（[operations](/brokers/nats/operations)） | ✅ 内置用户名/密码（login.properties/属性文件）与客户端证书，可插拔 SecurityManager（[operations](/brokers/artemis/operations)） |
| 授权粒度 | ✅ vhost 内按 exchange/queue 资源配置读写权限（正则匹配）（[operations](/brokers/rabbitmq/operations)） | ✅ ACL：topic/group/cluster 级，按 principal 配置读写权限（[operations](/brokers/kafka/operations)） | ✅ ACL：Topic 级 pub/sub 权限控制（[operations](/brokers/rocketmq/operations)） | ✅ tenant/namespace/topic 多级权限，策略按命名空间管理（[operations](/brokers/pulsar/operations)） | ✅ ACL 到命令级 + 键模式（key pattern）匹配，可限制只读/只写某类键（[operations](/brokers/redis-streams/operations)） | ✅ Account 隔离 + 用户级 publish/subscribe Subject 权限（[operations](/brokers/nats/operations)） | ✅ security-settings：角色 × 地址（支持通配）授予 send/consume/createQueue/manage 等权限（[operations](/brokers/artemis/operations)） |
| 多租户隔离 | 🔧 vhost 隔离资源与权限，但无原生配额/流控体系（[concepts](/brokers/rabbitmq/concepts)） | ➖ 无租户层级：命名约定 + ACL + Quota 组合（[operations](/brokers/kafka/operations)） | ➖ 无租户层级：ACL + 实例/部署隔离（[operations](/brokers/rocketmq/operations)） | ✅ Tenant/Namespace 原生隔离：权限、配额、保留策略一体化（[concepts](/brokers/pulsar/concepts)） | ➖ 无租户层级：ACL + DB 编号/键前缀约定（[operations](/brokers/redis-streams/operations)） | ✅ Account 原生隔离：独立 Subject 空间、连接与 JetStream 配额（[concepts](/brokers/nats/concepts)） | ➖ 无租户层级：角色 + 地址权限 + 地址前缀约定（[operations](/brokers/artemis/operations)） |
| 审计 | 🔧 内置审计日志记录管理与连接事件（3.9+），需开启与采集（[operations](/brokers/rabbitmq/operations)） | 🔧 社区版无统一审计服务：依赖 Authorizer 日志接入审计系统（[operations](/brokers/kafka/operations)） | 🔧 以操作日志为主，需自行接入审计管道（[operations](/brokers/rocketmq/operations)） | 🔧 管理操作日志 + 事件审计能力，需配置采集（[operations](/brokers/pulsar/operations)） | 🔧 MONITOR/慢日志为主，无消息级审计；需外部采集（[operations](/brokers/redis-streams/operations)） | 🔧 服务器日志 + 系统账号事件（连接/认证/账号限额），需采集（[operations](/brokers/nats/operations)） | 🔧 安全拒绝与管理操作记录在 Broker 日志，需开启与采集（[operations](/brokers/artemis/operations)） |

## 生产安全基线（七产品通用）

- 生产启用 TLS 并校验服务端身份；双向 TLS 作为可选强化。
- 每个服务独立身份，按 Topic/Queue/命名空间最小授权；禁止共享超级账号。
- Demo 默认账号（如 guest/guest）禁止用于生产——见各产品[陷阱与检查表](/brokers/rabbitmq/pitfalls)。
- 管理端口与数据端口分离，管理界面只绑定内网/localhost。
- 消息 Payload 中的个人信息、凭证、支付数据需分类脱敏；必要时用应用层字段加密或 Pulsar 消息级加密。
- 秘密不进仓库、URL、日志与实验快照；证书/密钥建立轮换流程。

## 脚注：同名异义

- **「ACL」**：Kafka ACL 是绑定 principal 的资源级规则；RocketMQ ACL 是账号 + Topic pub/sub 权限；Pulsar 的策略体系按 tenant/namespace 分层；Redis ACL 按命令与键模式授权；NATS 权限按 Account + publish/subscribe Subject 配置；Artemis security-settings 按角色 × 地址授予操作权限。六者的配置位置、生效粒度与更新方式不同，不能套用同一条规则模板。
- **「vhost vs tenant vs account」**：RabbitMQ vhost 是资源与权限的轻量隔离边界；Pulsar tenant 是带配额、策略与层级命名空间的租户单元；NATS account 是独立 Subject 空间 + 配额的原生租户。前者偏「逻辑分区」，后两者偏「平台多租户」。

## 相关页面

- 密钥/账号泄露后的观测与处置：[运维观测](/matrix/operations)
- 多租户对选型的影响：[选型指南](/matrix/selection-guide)
