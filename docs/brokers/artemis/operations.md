# ActiveMQ Artemis 运维与观测

> 本页结论：Artemis 的运维入口是 hawtio Web 控制台（8161）、JMX、`artemis` CLI 与内置 metrics 插件；积压观察的核心是队列消息计数（含 scheduled 与 paging 状态），死信与过期地址必须配告警。

## 运维入口

| 入口 | 用途 |
| :--- | :--- |
| Web 控制台（8161，hawtio） | 地址/队列浏览、发送测试消息、查看连接与消费者、JMX 图形化 |
| JMX | 全部管理属性/操作：深度、速率、分页状态、强制消息移动/删除 |
| `artemis` CLI | `artemis queue stat`（队列统计）、`artemis check node/queue`（健康探测）、`artemis address create` 等 |
| metrics 插件 | Micrometer/JSON 指标导出（`etc/management.xml` 与 metrics 插件配置） |

本仓库实验用 `QueueBrowser` 实现 `stats` 命令（客户端视角的深度清点），不依赖容器内 CLI——两种视角读数一致时可交叉验证。

## 关键指标

| 指标 | 含义 | 告警建议 |
| :--- | :--- | :--- |
| MessageCount / DurableMessageCount | 队列深度（全部 / 持久） | 持续增长 = 消费能力不足 |
| ScheduledCount | 等待定时投递的消息数 | 异常增长说明延迟参数被误用 |
| Paging 状态 | 地址是否进入分页 | 进入分页即应关注积压来源 |
| DeliverCount / AcknowledgeCount 速率 | 投递与确认速率 | 差值持续扩大 = 消费失败或重投风暴 |
| 死信地址深度 | `orders-dlq` 等 DLQ 的消息数 | **非零即告警**：毒消息或系统性失败 |
| 过期地址深度 | expiry-address 的消息数 | TTL 配置不当的信号 |
| 连接数 / 消费者数 | 会话与消费者分布 | 消费者掉线检测（结合业务心跳） |

## 积压诊断路径

1. **哪个队列积压**：控制台或 `queue stat` 按 MessageCount 排序；
2. **消费者在不在**：消费者数为 0 → 连接/部署问题；有消费者但深度涨 → 看处理耗时与失败率；
3. **是否在重投风暴**：`consume_failed` 类日志 + DeliverCount 增速远超业务增速 → 检查 address-setting 的重试上限与死信配置；
4. **分页了吗**：分页中消费走磁盘，追赶速度下降是预期行为，先扩消费者再谈扩容。

## 日常操作速查

```bash
# 队列统计（容器内）
bin/artemis queue stat --url tcp://127.0.0.1:61616 --user <u> --password <p>

# 节点健康探测（可入 CI/存活探针）
bin/artemis check node --url http://127.0.0.1:8161 --user <u> --password <p>

# 浏览/移动死信（JMX 或控制台等价操作）
# 控制台：Queues → 选中 DLQ → Move/Remove
```

- 变更 address-setting 需重载或滚动重启（本仓库版本不做热下发）；变更前评估在途消息的新策略生效范围。
- 升级遵循官方迁移说明；journal 格式跨大版本可能需导出/导入。

## 与其它产品对照

| 维度 | Artemis | RabbitMQ | RocketMQ |
| :--- | :--- | :--- | :--- |
| 控制台 | hawtio（8161） | management（15672） | dashboard/proxy |
| 积压指标 | 队列 MessageCount | queue depth + unacked | consumer lag（Consume Diff） |
| DLQ 观察 | 死信地址深度 | 死信队列深度 | %DLQ% 组 Topic |

## 边界

- `QueueBrowser` 深度是**瞬时快照**，高吞吐下与 JMX 计数可能有毫秒级差异，趋势比单点值重要。
- JMX 全量拉取在超大集群上代价高，规模化后以 metrics 插件导出为主。

## cli-tools：纯自带 CLI 实验

bin 目录仅统一入口 `artemis`（另有 artemis.cmd/lib），producer/consumer/browser 子命令即可完成收发闭环：`check node` 探活 → `queue create --silent` 建 durable anycast 队列 → `producer` 循环 3 次各发 1 条（`--message` 只能固定内容）→ `consumer --message-count 3` 收满自动退出。`queue stat` 复查 MESSAGE COUNT=0、MESSAGES ACKED=3，browser 浏览余量为 0；镜像 security-enabled=true，每条命令都需带 `--user/--password/--url`。

<LabOutput product="artemis" lab="cli-tools" />
