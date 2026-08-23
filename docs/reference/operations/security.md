# 安全基线

> 本页结论：消息系统的安全基线是三件套——认证（谁在连接）、授权（能碰哪些 Topic/Queue）、传输加密（链路上不可窃听篡改），四个产品的机制名不同但要求等价。本仓库实验环境按约定不开认证、所有端口仅绑定 `127.0.0.1`，这是学习环境的豁免，不是生产建议；生产上线时 Demo 默认账号（如 guest/guest）是明确禁止项。

## 三件套在四产品的落地

| 产品 | 认证（authN） | 授权（authZ） | 传输加密（TLS） |
| :--- | :--- | :--- | :--- |
| RabbitMQ | 用户名/密码（SASL PLAIN）、mTLS 证书（EXTERNAL） | ACL 规则：按用户限定 vhost/exchange/queue 的 configure/write/read | AMQPS 5671；管理接口 15671 |
| Kafka | SASL（PLAIN/SCRAM/OAUTHBEARER 等）或 mTLS | ACL：按 principal 授予 topic/group 的 Read/Write/Create 等权限（kafka-acls 管理） | TLS 9093；可含 Broker 间链路 |
| RocketMQ | AccessKey/SecretKey（ACL） | ACL 规则：topic/group 级权限（发布/订阅/管理） | Broker 开启 TLS（证书配置） |
| Pulsar | JWT token、mTLS 证书、OAuth2 等 | 按 tenant/namespace/topic 授权（produce/consume/admin） | TLS 6651（broker）/ 8443（HTTP） |

共同要求（与产品无关）：

- **每个服务独立身份**：生产者与消费者各用自己的账号/证书，最小授权到具体的 Topic/Queue/Subject——一个全局共享账号等于没有授权。
- **TLS 必须验证服务端身份**：仅加密不校验证书等于给中间人开门；双向 TLS（mTLS）作为可选强化。
- **管理端口与数据端口分离**：管理面（RabbitMQ 15672、Kafka 管控 API、RocketMQ dashboard、Pulsar admin）单独限制网络访问，不与数据面混用暴露策略。

## §12.3 条目落地

| 基线条目 | 落地要点 |
| :--- | :--- |
| 生产启用 TLS、验证服务端身份 | 客户端配置 truststore/CA 并开启 hostname 验证；mTLS 可选 |
| 每服务独立身份、按目的地最小授权 | 建 topic 同时建账号与 ACL；权限变更走审计流程 |
| 秘密不进仓库/URL/日志/快照 | 账号密码走密钥管理或环境变量注入；连接串不含明文口令；日志脱敏过滤器覆盖 payload |
| 管理端口与数据端口分离 | 管理端口仅内网/堡垒机可达；防火墙与 Broker 监听地址双重限制 |
| Payload 敏感数据分类与脱敏 | 个人信息/凭证/支付数据在消息体内加密或只传引用 ID；信封字段（如 aggregateId）同样评估敏感性 |
| 加密边界说明 | 传输加密（TLS）只保护链路；静态加密依赖 Broker 所在存储（磁盘加密/云 KMS），不等于 Broker 原生能力；字段级加密在应用层完成，与两者独立叠加 |
| 审计与轮换 | 记录管理操作与权限变更；证书/密钥设轮换周期与到期告警，轮换与客户端 truststore 更新要同时演练 |
| Demo 默认账号禁用 | guest/guest、匿名访问、PLAINTEXT 默认端口清单进入[生产检查表](/reference/operations/production-checklist)禁止项 |

## 实验环境的约定（本仓库豁免项）

[实验约定](/reference/lab-conventions) 规定学习环境的安全形态：

- 所有 Broker 端口（5672/15672、9092、RocketMQ/Pulsar 对应端口）仅绑定 `127.0.0.1`，管理界面不暴露公网。
- RabbitMQ 使用默认 `guest/guest`——该账号被 Broker 自身限制为仅 localhost 可用；Kafka 实验使用 PLAINTEXT，不开认证。
- 消息内容为本仓库 fixture（`demos/shared/fixtures/`），不含真实个人信息。

以上每一条在生产都是禁止项或必须加固项；把实验 Compose 直接搬上生产是最常见的安全事故来源。

## 常见误区

- 「内网就不用 TLS」——内网横向移动与误暴露同样存在，基线要求生产一律启用。
- 「开了认证就有了安全」——认证不配最小授权，等于每个服务都是管理员。
- 「TLS 加密了日志就安全了」——消息落日志/快照时已解密，payload 脱敏是独立要求。
- 「密钥轮换只是运维的事」——轮换必须与客户端配置发布联动演练，否则就是计划内故障。

## 官方资料

- RabbitMQ Access Control：<https://www.rabbitmq.com/docs/access-control>（checkedAt: 2026-08-19）
- RabbitMQ TLS/SSL：<https://www.rabbitmq.com/docs/ssl>（checkedAt: 2026-08-19）
- Kafka Security：<https://kafka.apache.org/documentation/#security>（checkedAt: 2026-08-19）
- RocketMQ Access Control：<https://rocketmq.apache.org/docs/bestPractice/06access/>（checkedAt: 2026-08-19）
- Pulsar Security Overview：<https://pulsar.apache.org/docs/security-overview>（checkedAt: 2026-08-19）
