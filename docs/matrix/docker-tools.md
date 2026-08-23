# Docker 自带 CLI 矩阵

> 八个产品全部纳入；“完整闭环”只表示镜像自带命令能够完成状态、创建、生产、消费和复查，不代表能够替代生产 SDK。

| 产品 | 工具入口 | 创建 | 生产/消费 | 结论 |
| :--- | :--- | :--- | :--- | :--- |
| Kafka | `/opt/kafka/bin/*.sh` | `kafka-topics.sh` | console producer/consumer | 完整闭环 |
| Pulsar | `pulsar-admin` / `pulsar-client` | topics create | produce/consume | 完整闭环 |
| Redis Streams | `redis-cli` | `XGROUP CREATE` | `XADD` / `XREADGROUP` / `XACK` | 完整闭环 |
| RocketMQ | `mqadmin` | `updateTopic` | `sendMessage` / `consumeMessage` | 完整闭环 |
| Artemis | `artemis` | queue create | producer/consumer/browser | 完整闭环 |
| ActiveMQ Classic | `activemq` / `activemq-admin` | 管理入口 | 内置 CLI/示例闭环 | 完整收录 |
| RabbitMQ | `rabbitmqctl` / `rabbitmqadmin` | declare queue | management HTTP API | API 辅助 |
| NATS | `/nats-server` | 无 | 无镜像内建收发 CLI | 仅状态 |

详细命令和真实输出在各产品页中展示；原有步骤快照迁入 `demos/<product>/docker/`。
