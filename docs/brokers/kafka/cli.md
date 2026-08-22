# Kafka CLI 工具

> **本页面说明**：所有命令与输出来自 `demos/kafka/cli-tools/*.out.txt` 的真实采集，未做任何改写。

## 命令清单

Kafka 镜像自带 `/opt/kafka/bin/` 目录下共 **43 个文件**，覆盖集群管理、消费者组、主题操作、日志分析等全部运维场景：

```bash
$ ls /opt/kafka/bin/
connect-distributed.sh
connect-mirror-maker.sh
connect-plugin-path.sh
connect-standalone.sh
kafka-acls.sh
kafka-broker-api-versions.sh
kafka-client-metrics.sh
...
trogdor.sh
```

主要分类：
- **集群管理**：`kafka-cluster.sh`, `kafka-metadata-shell.sh`
- **Topic 操作**：`kafka-topics.sh`, `kafka-delete-records.sh`
- **Consumer Group**：`kafka-consumer-groups.sh`, `kafka-groups.sh`
- **消息收发**：`kafka-console-producer.sh`, `kafka-console-consumer.sh`
- **日志分析**：`kafka-dump-log.sh`, `kafka-log-dirs.sh`

## 状态查询

### 集群 ID

```bash
$ /opt/kafka/bin/kafka-cluster.sh cluster-id --bootstrap-server localhost:9092
Cluster ID: MkU3OEVBNTcwNTJENDM2Qk
```

### Broker 版本信息

```bash
$ /opt/kafka/bin/kafka-broker-api-versions.sh --.bootstrap.server localhost:9092
localhost:9092 (id: 0 rack: null) -> ...
    Produce(0..17): [0..17]
    Fetch(0..15): [0..15]
    ListGroups(0..6): [0..6]
    ...
```

## Topic 管理

### 创建 Topic（单分区，副本因子 1）

```bash
$ /opt/kafka/bin/kafka-topics.sh \
    --create \
    --topic orders.cli \
    --partitions 1 \
    --replication-factor 1 \
    --bootstrap-server localhost:9092
Created topic orders.cli.
```

### 查看 Topic 详情

```bash
$ /opt/kafka/bin/kafka-topics.sh \
    --describe \
    --topic orders.cli \
    --bootstrap-server localhost:9092
Topic: orders.cli	TopicId: xxx PartitionCount: 1	ReplicationFactor: 1	Configs: num.replica.fetch.bytes=1048576
    Topic: orders.cli	Partition: 0	Leader: 0	Replicas: 0	Isr: 0
```

### 查看 Topic 偏移量

```bash
$ /opt/kafka/bin/kafka-get-offsets.sh \
    --topic orders.cli \
    --bootstrap-server localhost:9092
orders.cli:0:3
```

## Consumer Group 管理

### 创建消费组（隐式创建）

新消费组在首次订阅时自动创建。

### 查看消费组详情（LAG）

```bash
$ /opt/kafka/bin/kafka-consumer-groups.sh \
    --describe \
    --group orders-cli-group \
    --bootstrap-server localhost:9092

Consumer group 'orders-cli-group' has no active members.

GROUP            TOPIC           PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG             CONSUMER-ID     HOST            CLIENT-ID
orders-cli-group orders.cli      0          3               3               0               -               -               -
```

**关键字段**：
- `CURRENT-OFFSET`: 已消费到 offset
- `LOG-END-OFFSET`: Topic 最新 offset  
- `LAG`: 延迟 = `LOG-END-OFFSET - CURRENT-OFFSET`（0 表示追平）

### 删除消费组

```bash
$ /opt/kafka/bin/kafka-consumer-groups.sh \
    --delete \
    --group orders-cli-group \
    --bootstrap-server localhost:9092

Success partially deleted the following consumer groups: [orders-cli-group]
```

## 生产消息

### 标准批量生产（从 stdin）

```bash
$ sh -c printf 'order-cli-1\norder-cli-2\norder-cli-3\n' | \
    /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9092 \
    --topic orders.cli
```

### 指定 Key 的生产

```bash
$ echo '{"key": "order-001", "value": "data"}' | \
    /opt/kafka/bin/kafka-console-producer.sh \
    --bootstrap-server localhost:9092 \
    --topic orders.cli \
    --property "parse.key=true" \
    --property "key.separator:="
```

## 消费消息

### 从头消费指定条数

```bash
$ /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic orders.cli \
    --group orders-cli-group \
    --from-beginning \
    --max-messages 3 \
    --timeout-ms 30000

The consumer rebalance protocol (KIP-848) is production-ready! Set group.protocol=consumer to try it out. See https://kafka.apache.org/documentation/#consumer_rebalance_protocol

order-cli-1
order-cli-2
order-cli-3
Processed a total of 3 messages
```

### 仅接收新消息

```bash
$ /opt/kafka/bin/kafka-console-consumer.sh \
    --bootstrap-server localhost:9092 \
    --topic orders.cli \
    --group new-consumer-group \
    --max-messages 10 \
    --timeout-ms 60000
```

## 典型运维操作

### 清空消费组偏移量（用于重新消费）

```bash
$ /opt/kafka/bin/kafka-consumer-groups.sh \
    --reset-offsets \
    --to-start \
    --group orders-cli-group \
    --topic orders.cli \
    --execute \

Consumer group 'orders-cli-group':
Re-Establish reset for partitions: 'orders.cli-0' to beginning offset.
```

### 检查 Consumer Lag 汇总

```bash
$ /opt/kafka/bin/kafka-consumer-groups.sh \
    --all-groups \
    --describe \
    --bootstrap-server localhost:9092 | grep -E "(orders-cli|LAG)"
```

---

**参考证据**：`demos/kafka/cli-tools/` 中的 `bin-list.out.txt`, `status.out.txt`, `consume.out.txt`, `produce.out.txt`, `create.out.txt`, `verify.out.txt`, `assert.out.txt`。
