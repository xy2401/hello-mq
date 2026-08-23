# ActiveMQ Classic 运维与观测

> 本页结论：Classic 的运维入口是 Web 控制台（8161 jetty，默认 admin/admin）、JMX 与统一 CLI 入口 `bin/activemq`（task 制）；积压观察的核心是队列深度与 Enqueue/Dequeue 计数差，共享死信 ActiveMQ.DLQ 的深度必须配告警。

## 运维入口

| 入口 | 用途 |
| :--- | :--- |
| Web 控制台（8161，jetty） | Queue/Topic 浏览与清空、发送测试消息、查看连接与消费者；默认凭据 admin/admin，生产必改 |
| JMX | 全部管理属性/操作：深度、入队/出队计数、消息移动/删除（managementContext 配置） |
| `bin/activemq` 统一入口 | task 制：start/stop/status、producer/consumer（收发工具）、browse/purge、bstat/dstat/query/list、backup/export、encrypt/decrypt 等（task 清单实测见 cli-tools 小节） |
| 客户端探针 | 本仓库 `stats` 命令用 `QueueBrowser` 清点深度（客户端视角，不依赖容器内 CLI） |

## 关键指标

| 指标 | 含义 | 告警建议 |
| :--- | :--- | :--- |
| QueueSize（队列深度） | 未消费消息数（QueueBrowser/JMX 可读数） | 持续增长 = 消费能力不足 |
| EnqueueCount / DequeueCount | 入队 / 出队累计 | 差值持续扩大 = 消费失败或积压 |
| ActiveMQ.DLQ 深度 | 全 broker 共享死信的消息数 | **非零即告警**：毒消息或系统性失败；无法区分业务线（见 [陷阱](/products/activemq-classic/pitfalls)） |
| memory/store 使用率 | systemUsage 占用 | 接近限额 = 即将触发 producer flow control |
| 连接数 / 消费者数 | 会话与消费者分布 | 消费者掉线检测（结合业务心跳） |

## 积压诊断路径

1. **哪个队列积压**：控制台 Queues 页或 JMX 按深度排序；
2. **消费者在不在**：消费者数为 0 → 连接/部署问题；有消费者但深度涨 → 看处理耗时与失败率；
3. **是否在重投风暴**：`consume_failed` 类日志 + 出队计数增速远超业务增速 → 检查 redeliveryPolicy 的 maximumRedeliveries 与间隔；
4. **流控了吗**：store 使用率触顶后生产者被减速，追赶速度下降是预期行为，先扩消费者再谈扩容。

## 日常操作速查

```bash
# 容器内统一入口（ACTIVEMQ_HOME=/opt/apache-activemq）
bin/activemq status          # 实测输出：ActiveMQ is running (pid '1')
bin/activemq producer --destination queue://orders-cli --messageCount 1 --message probe
bin/activemq consumer --destination queue://orders-cli --messageCount 1
```

- 其余 task（browse/purge/bstat/dstat/query/backup/export 等）的用途见 cli-tools 小节的实测 task 清单；各 task 参数用 `bin/activemq <task> -h` 查询。
- 修改 activemq.xml（destinationPolicy、认证插件等）需重启 broker 生效；变更前评估在途消息影响。
- 升级遵循官方迁移说明；KahaDB 数据目录先备份。

## 与其它产品对照

| 维度 | Classic | RabbitMQ | Artemis |
| :--- | :--- | :--- | :--- |
| 控制台 | jetty（8161，admin/admin） | management（15672） | hawtio（8161） |
| 积压指标 | QueueSize + Enqueue/Dequeue | queue depth + unacked | 队列 MessageCount |
| DLQ 观察 | 共享 ActiveMQ.DLQ 深度 | 死信队列深度 | 死信地址深度 |

## 边界

- `QueueBrowser` 深度是**瞬时快照**，高吞吐下与 JMX 计数可能有毫秒级差异，趋势比单点值重要。
- 默认配置下 61616 匿名可连、控制台 admin/admin——观测能力不设防，安全基线必须先于生产上线（见 [陷阱与检查表](/products/activemq-classic/pitfalls)）。

## cli-tools：纯自带 CLI 实验

6.2.0 镜像的 bin 目录仅 7 项（`activemq` 统一入口、`activemq-diag`、`activemq.jar`、`setenv`、`wrapper.jar`、`linux-x86-64`、`macosx`），统一入口为 task 制：producer/consumer 子命令即可完成收发闭环，`status` 查运行状态（实测输出 `ActiveMQ is running (pid '1')`）。Classic 没有显式建队命令：向全新队列 `orders-cli` 首次生产即自动创建。OpenWire 默认匿名，命令无需 user/password 参数（区别于 Artemis 镜像的 security-enabled=true）；`--message` 只能固定内容，run.sh 循环 3 次各发 1 条。自带 consumer **没有 receive-timeout 参数**，空队列时 `consumer --messageCount 1` 无限阻塞，实验用 `timeout 15` 包裹并断言 exit=124 证明队列已排空。

<LabOutput product="activemq-classic" lab="cli-tools" />
