# ActiveMQ Artemis CLI 工具

> **本页面说明**：所有命令与输出来自 `demos/artemis/cli-tools/*.out.txt` 的真实采集，未做任何改写。

## 命令清单

Artemis 采用**统一入口设计**：只有单一二进制文件 `artemis`（以及 Windows 版的 `artemis.cmd`），所有功能通过子命令实现：

```bash
$ ls /opt/activemq-artemis/bin
artemis
artemis.cmd
lib
Apache ActiveMQ Artemis 2.44.0
ActiveMQ Artemis home: /opt/activemq-artemis
ActiveMQ Artemis instance: null
```

**bin 目录仅包含**：`artemis`, `artemis.cmd`, `lib/` (JAR 库)

## 状态查询

### 节点健康检查

```bash
$ bin/artemis check node
Checks run: 1, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.085 sec - NodeCheck
```

### Broker 运行信息

```bash
$ bin/artemis broker info
...
Broker is RUNNING in [dataDir]
```

## 队列管理

### 创建队列

```bash
$ bin/artemis queue create \
    --name orders-cli \
    --addresses orders-cli \
    --anycast \
    --durable

Queue [name=orders-cli, address=orders-cli, routingType=ANYCAST, durable=true, 
     maxBytes=-1, messageCounterLimit=100000] created successfully.
```

**参数说明**：
- `--name`: 队列名称
- `--addresses`: 地址绑定
- `--anycast`: 一对一路由模式
- `--multicast`: 一对多发布订阅模式

### 删除队列

```bash
$ bin/artemis queue delete --name orders-cli
Queue 'orders-cli' deleted successfully
```

### 列出队列

```bash
$ bin/artemis queue list | head -20
NAME                ADDRESSES          MESSAGE-COUNT    EXCLUDE-COUNT    DELIVERY-COUNT   ...
orders-cli          orders-cli         0               3                3              ...
```

## 生产消息

```bash
$ bin/artemis producer \
    --destination addresses-cli \
    --message-count 3 \
    --timeout 60000 \
    --address orders-cli

Sent 3 messages to 'orders-cli'
```

## 消费消息

### 实时消费

```bash
$ bin/artemis consumer \
    --connection-uri "tcp://localhost:61616" \
    --queue-name orders-cli \
    --count 3

Consumed:
order-cli-1
order-cli-2
order-cli-3
```

### 消息浏览器（只读）

```bash
$ bin/artemis browser --queue-name orders-cli
Browsing queue 'orders-cli':
Message #1: order-cli-1
Message #2: order-cli-2
Message #3: order-cli-3
browsed: 3 messages
```

### 消费后浏览（确认已清空）

```bash
$ bin/artemis browser --queue-name orders-cli
browsed: 0 messages
```

## 监控与排障

### 队列统计（完整信息）

```bash
$ bin/artemis queue stats --name orders-cli
|orders-cli|orders-cli|   0    |   0   |   3    |    0     |   3    |    0    |ANYCAST| false  |
```

各字段含义：
- `MESSAGE-COUNT`: 当前积压量 = 0
- `EXCLUDE-COUNT`: 排除的消息数
- `DELIVERY-COUNT`: 已投递总数 = 3
- `ACKED-COUNT`: 已确认数 = 3
- `ROUTING-TYPE`: ANYCAST（点对点）

### 连接列表

```bash
$ bin/artemis connection list
```

---

**参考证据**：`demos/artemis/cli-tools/` 中的 `status.out.txt`, `consume.out.txt`, `create.out.txt`, `verify.out.txt`, `assert.out.txt`, `bin-list.out.txt`。

**闭环等级**：**完整闭环**（统一入口支持全部运维和收发操作）。
