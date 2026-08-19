# NATS 核心概念映射

> 本页结论：NATS 的知识模型必须分两层建立——Core NATS（Subject/Queue Group，易失）与 JetStream（Stream/Consumer，持久）。同一句「消息已发送」在两层含义完全不同，本页按统一知识模型逐维度给出两层的各自答案。

## 实体映射

| 统一模型 | Core NATS | JetStream |
| :--- | :--- | :--- |
| Message | 纯字节消息（可带头部） | 存入 Stream 的消息（带元数据：序列号、时间戳） |
| Topic | Subject（层级 + 通配符） | Stream 的 subjects 过滤集合 |
| Subscription / Group | Subscription / Queue Group | Consumer（Durable/Ephemeral） |
| Offset / Cursor | 不存在（无存储） | Consumer 的投递位点（按 Stream 序列号） |
| ACK | 不存在 | AckPolicy：None/All/Explicit |
| Retention | 不适用（即发即弃） | Stream 保留策略：Limits/Interest/WorkQueue |

## 核心 API 速查

| 操作 | Core NATS | JetStream |
| :--- | :--- | :--- |
| 发送 | `publish(subject, bytes)`（无应答） | `js.publish(subject, bytes)` → PublishAck |
| 订阅 | `subscribe` / `Dispatcher` | `js.subscribe`（Push 或 Pull `fetch`） |
| 竞争消费 | `queueSubscribe(subject, group)` | 同一 Durable Consumer 多客户端（共享队列语义） |
| 请求响应 | `request(subject, bytes, timeout)` | 不适用（用 Core 层） |
| 管理 | — | JetStreamManagement：Stream/Consumer CRUD、`getStreamInfo` |

## 十二维度逐一回答

1. **定位**：Core 是轻量连接总线（易失）；JetStream 是内置持久事件流——一个产品两种可靠性目标。
2. **核心实体**：见上表；Consumer 是最关键的概念，它把「位点 + 确认策略 + 重投策略 + 起始位置」打包。
3. **路由**：Subject 层级 + `*`（一段）/`>`（多段）通配符；JetStream 用 subjects 过滤把消息捕获进 Stream，详见 [路由与分发](/brokers/nats/routing)。
4. **存储与保留**：Core 无存储；JetStream 支持 Memory/File 存储与三种保留策略，消费不删除（WorkQueue 策略除外）。
5. **生产可靠性**：Core publish 无确认；JetStream publish 有 PublishAck + 客户端重试 + 服务端去重窗口（Msg-Id）。
6. **消费可靠性**：Core 无确认概念；JetStream Explicit ACK + AckWait 重投 + MaxDeliver 上限。
7. **投递语义**：Core = at-most-once；JetStream = at-least-once（Explicit）；服务端不提供跨系统 exactly-once。
8. **顺序**：Subject/Stream 内对单个订阅者/消费者有序；重投与并行 ACK 会破坏处理完成顺序。
9. **失败处理**：Core 不适用；JetStream 用 AckWait/MaxDeliver 自建重试，超限消息可发布到 DLQ Stream（应用模式）。
10. **高可用**：Core 无状态 Cluster；JetStream Stream R1/R3（Raft 复制）、Supercluster Mirror/Source 跨集群。
11. **安全与可观测**：NKey/JWT 认证、按 Subject/Account 授权、TLS；监控走 `/varz /jsz /healthz` HTTP 端点。
12. **限制与反模式**：见 [陷阱与检查表](/brokers/nats/pitfalls)。

## Durable / Ephemeral × Push / Pull

| | Push（服务端推） | Pull（客户端拉） |
| :--- | :--- | :--- |
| **Durable**（命名、服务端持久） | 经典可靠订阅：断线后位点保留，重连续投 | 本仓库实验采用的形态：`fetch(batch, timeout)`，消费节奏自控 |
| **Ephemeral**（随连接生灭） | 在线即收，断线即销毁 | 临时批处理读取 |

本仓库 `jetstream-replay` 实验用两个不同的 **Durable Pull Consumer**：`orders-first` 正常消费，`orders-replay` 从头回放——同一个 Stream，两个独立位点。

## 不可直接等价之处

- **Queue Group ≠ Kafka Consumer Group**：Queue Group 是 Core 层的订阅者负载分担，无位点、无存储；断线期间消息直接丢失。竞争消费的「可靠版」是 JetStream 共享 Consumer。
- **Stream ≠ Kafka Topic**：Stream 按 subjects 捕获、整体复制（R3），没有分区内并行的扩展模型。
- **Core publish ≠ JetStream publish**：前者字节进路由器即结束；后者要写入存储并收到 Ack。规格 §7.6 明确要求：两者的 API 与可靠性结论不可混写。
- **Interest/WorkQueue 保留策略**会让「被消费」影响删除——默认 Limits 策略下 ACK 不删除，与 Kafka 一致；不要跨策略泛化结论。
