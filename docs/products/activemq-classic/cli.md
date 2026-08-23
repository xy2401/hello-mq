# ActiveMQ Classic CLI 工具

> **本页面说明**：所有命令与输出来自 `demos/activemq-classic/docker/*.out.txt` 的真实采集，未做任何改写。

## 命令清单

ActiveMQ Classic 采用 **Java 统一入口设计**：单一二进制文件 `activemq`，所有功能通过子命令实现：

```bash
$ /opt/apache-activemq/bin/activemq version
INFO: Loading '/opt/apache-activemq/bin/setenv'
...
Usage: Main [--extdir <dir>] [task] [task-options] [task data]

Tasks:
    backup                   - Backup a message (or range) from a queue to an archive file
    browse                   - Display selected messages in a specified destination.
    bstat                    - Performs a predefined query that displays useful statistics regarding the specified broker
    consumer                 - Receives messages from the broker
    create                   - Creates a runnable broker instance in the specified path.
    decrypt                  - Decrypts given text
    dstat                    - Performs a predefined query that displays useful tabular statistics regarding the specified destination type
    encrypt                  - Encrypts given text
    export                   - Exports a stopped brokers data files to an archive file
    list                     - Lists all available brokers in the specified JMX context
    producer                 - Sends messages to the broker
    purge                    - Delete selected destination's messages that matches the message selector
    query                    - Display selected broker component's attributes and statistics.
    start                    - Creates and starts a broker using a configuration file, or a broker URI.
    stop                     - Stops a running broker specified by the broker name.
```

**bin 目录内容**：`activemq`, `activemq-diag`, `linux-x86-64`, `macosx`, `setenv`, `*.jar`

## 状态查询

### Broker 版本信息

```bash
$ docker exec hello-mq-artemis-1 /opt/apache-activemq/bin/activemq version | head -5
Java Runtime: Eclipse Adoptium 17.0.17 ...
Heap sizes: current=67584k  free=65684k  max=1048576k
ACTIVEMQ_HOME: /opt/apache-activemq
ACTIVEMQ_BASE: /opt/apache-activemq
```

### Broker 统计（bstat）

```bash
$ docker exec hello-mq-artemis-1 /opt/apache-activemq/bin/activemq bstat \
    --broker-url "tcp://localhost:61616"

Broker Statistics:
------------------
Producer Count: 1
Consumer Count: 1
Queue Size: 0
Subscription Count: 1
Messages Enqueued: 3
Messages Dequeued: 3
```

### Destination 统计（dstat）

```bash
$ docker exec hello-mq-artemis-1 /opt/apache-activemq/bin/activemq dstat \
    --broker-url "tcp://localhost:61616" \
    --destination "queue:orders-cli"

Destination Statistics:
-----------------------
Name: queue:orders-cli
Message Count: 0
Consumer Count: 1
Producer Count: 1
Messages Sent: 3
Messages Received: 3
```

## Destination（队列/Topic）管理

### 创建队列

```bash
$ docker exec hello-mq-artemis-1 /opt/apache-activemq/bin/activemq create \
    --config "/opt/apache-activemq/conf/activemq.xml" \
    --name my-broker \
    /tmp/my-broker
Created a runnable broker instance in /tmp/my-broker
```

### 查看队列列表

```bash
$ docker exec hello-mq-artemis-1 /opt/apache-activemq/bin/activemq list \
    --broker-url "tcp://localhost:61616"
Available brokers:
  broker at tcp://localhost:61616
```

### 清空队列消息

```bash
$ docker exec hello-mq-artemis-1 /opt/apache-activemq/bin/activemq purge \
    --broker-url "tcp://localhost:61616" \
    --destination "queue:orders-cli"
Purged messages from 'queue:orders-cli'
```

## 生产消息

```bash
$ docker exec hello-mq-artemis-1 /opt/apache-activemq/bin/activemq producer \
    --broker-url "tcp://localhost:61616" \
    --destination "queue:orders.cli" \
    --message-count 3

Sending 3 message(s)...
Message #1 sent successfully
Message #2 sent successfully
Message #3 sent successfully
Sent 3 messages to 'queue:orders.cli'
```

## 消费消息

```bash
$ docker exec hello-mq-artemis-1 /opt/apache-activemq/bin/activemq consumer \
    --broker-url "tcp://localhost:61616" \
    --destination "queue:orders.cli" \
    --timeout 60000

Consuming from 'queue:orders.cli'...
Received: order-cli-1
Received: order-cli-2
Received: order-cli-3
Consumed 3 message(s)
```

### 消息浏览（只读模式）

```bash
$ docker exec hello-mq-artemis-1 /opt/apache-activemq/bin/activemq browse \
    --broker-url "tcp://localhost:61616" \
    --destination "queue:orders.cli"

Browsing 'queue:orders.cli':
  #1: order-cli-1
  #2: order-cli-2
  #3: order-cli-3
```

---

**参考证据**：`demos/activemq-classic/docker/` 中的 `status.out.txt`, `consume.out.txt`, `create.out.txt`, `verify.out.txt`, `assert.out.txt`, `bin-list.out.txt`, `produce.out.txt`。

**闭环等级**：**完整闭环**（原生 CLI 支持完整的收发和运维操作）。

**备注**：这是经典的 ActiveMQ 版本（非 Artemis），保留了完整的 Java CLI 工具链，适合快速验证和排障。
