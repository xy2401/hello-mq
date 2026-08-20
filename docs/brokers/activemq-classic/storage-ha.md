# ActiveMQ Classic 存储与高可用

> 本页结论：Classic 用 KahaDB（文件式追加存储）持久化消息，确认后删除，无日志式保留与回放；积压触达 systemUsage 限额时对生产端流控（背压）。高可用靠 master/slave（共享文件系统或 JDBC 锁），多节点扩展靠 Networks of Brokers——但单个队列不做分区拆分。

## 存储模型：KahaDB + 确认即删除

- **KahaDB**：默认 persistenceAdapter（镜像默认 conf：`<kahaDB directory="${activemq.data}/kahadb"/>`），文件式追加存储，为消息引擎的本地持久化优化（官方文档 E1）；另有 JDBC 存储等替代方案。
- **确认即删除**：消息被消费确认后从存储生命周期中移除——Classic 不是保留日志，不能像 Kafka/Pulsar/Redis Streams 那样按位点或时间回放。
- **ACTIVEMQ_HOME**：镜像内为 `/opt/apache-activemq`，数据目录 `${activemq.data}`（即 `/opt/apache-activemq/data`）；容器化部署要持久化的就是该目录。

## 积压与背压：systemUsage 与 producer flow control

镜像默认 conf 的 systemUsage（官方默认值）：

| 限额 | 默认值 | 触达后的行为 |
| :--- | :--- | :--- |
| memoryUsage | JVM 堆的 70% | 目的地内存超限 → 消息换页到存储/临时区，消费变慢 |
| storeUsage | 100 gb | 存储超限 → **producer flow control**：生产者被减速/阻塞 |
| tempUsage | 50 gb | 非持久与临时数据超限 → 同上 |

- 背压直接传导给生产端线程：持续流控说明消费能力不足，先扩消费者（见 [运维与观测](/brokers/activemq-classic/operations) 的深度告警），而不是盲目调大限额。
- 目的地级内存限额可用 policyEntry 的 `memoryLimit` 细化；镜像默认 conf 已对 `topic>` 配置 pendingMessageLimitStrategy（constant limit=1000）保护慢订阅。

## 高可用：master/slave

```mermaid
flowchart LR
  M[master broker<br/>持有 KahaDB 锁] -- "共享存储 / JDBC 锁" --> S[slave broker<br/>待命接管]
  C[客户端] -- "failover://tcp://m:61616,tcp://s:61616" --> M
```

- **Shared File System Master Slave**：master/slave 共享同一 KahaDB 目录（分布式文件系统），靠文件锁决定主从（官方文档 E1）；部署简单但对共享存储要求高。
- **JDBC Master Slave**：用数据库行锁做仲裁，存储走 JDBC store。
- 切换语义：slave 接管后继续服务；客户端用 `failover://` URI 自动重连（自带 CLI 工具默认就连 failover URL），切换瞬间的 in-flight 消息会重投，业务侧仍需幂等兜底。

## 扩展：Networks of Brokers 分布队列，不分区单队列

- Networks of Brokers 用 networkConnector 把多个 broker 连成网络，按需转发（demand forwarding）订阅与消息，实现跨节点的队列/Topic 分布（官方文档 E1）；
- **单个 Queue 的处理仍落在单节点**：单队列吞吐上限 ≈ 单节点能力。需要更高并行度时按业务维度拆多个队列，或用 VirtualTopics 按消费组拆队列，而不是期望自动分区；
- 与 Kafka（分区内扩展）和 Pulsar（topic 分片）的扩展路径根本不同——选型时先估算单队列吞吐需求。

## 与其它产品对照

| 维度 | Classic | Kafka/Pulsar | Redis Streams |
| :--- | :--- | :--- | :--- |
| 持久化单元 | KahaDB（确认后回收） | 分区/分片日志（保留） | Stream 条目（XTRIM 裁剪） |
| 回放 | ➖ | ✅ offset/位置重置 | ✅ XRANGE 回读 |
| 积压承载 | 换页到存储 + 生产端流控 | 日志即积压 | 内存为主 |
| 扩展单元 | 多队列分布（网络） | 分区/分片 | 多 key（单 key 不可拆） |

## 边界

- KahaDB 所在盘的 fsync 延迟直接决定持久消息吞吐；慢盘上先评估磁盘，而不是加节点。
- master/slave 解决可用性不解决吞吐；吞吐扩展只能靠多队列 + Networks of Brokers 分布。
- 升级遵循官方迁移说明；KahaDB 数据目录跨大版本迁移前先备份。
