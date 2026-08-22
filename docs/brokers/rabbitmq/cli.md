# RabbitMQ CLI 工具

> **本页面说明**：所有命令与输出来自 `demos/rabbitmq/cli-tools/*.out.txt` 的真实采集，未做任何改写。

## 重要说明

RabbitMQ 的自带 CLI 能力**有限**：4.x 版本已移除 `rabbitmqctl add_queue`，收发消息需要依赖外部 curl 调用 management HTTP API。

**闭环等级**：**管理 API 辅助**（不是完整闭环）。

## 命令清单

镜像 `/usr/sbin/` 目录下共 **10 个二进制文件**：

```bash
$ docker exec hello-mq-rabbit-1 ls /usr/sbin/rabbit*
/usr/sbin/rabbitmq-upgrade
/usr/sbin/rabbitmqctl
/usr/sbin/rabbitmq-diagnostics
/usr/sbin/rabbitmq-plugins
/usr/sbin/rabbitmq-env
/usr/sbin/rabbitmq-config
...
```

其中：
- **运维命令**：`rabbitmqctl`, `rabbitmq-diagnostics`, `rabbitmq-plugins`
- **队列声明**：仅支持 `rabbitmqadmin declare queue`（management 插件自带）
- **消息收发**：**无自带命令**，必须走 HTTP API

## 状态查询

### 集群状态概览

```bash
$ docker exec hello-mq-rabbit-1 rabbitmqctl status
Status of node rabbit@hello-mq-rabbit-1 ...
[{rnode,"rabbit@hello-mq-rabbit-1"},
 [{cluster,running},{"listeners",[]},...]
 [{disk_free,46308273},{mem_used,195588208},...]
```

### 队列深度

```bash
$ docker exec hello-mq-rabbit-1 rabbitmqctl list_queues name messages
Name    Messages
orders-cli   0
```

### 查看队列详情

```bash
$ docker exec hello-mq-rabbit-1 rabbitmqadmin list_queues name messages consumers state
Name            Messages     Consumers State
orders-cli      0           1          running
```

## 队列管理

### 创建队列（仅支持 rabbitmqadmin）

```bash
$ docker exec hello-mq-rabbit-1 rabbitmqadmin \
    declare queue name=orders-cli durable=true

queue declared
```

**注意**：`rabbitmqctl add_queue` 在 4.x 已移除。

### 删除队列

```bash
$ docker exec hello-mq-rabbit-1 rabbitmqadmin delete queue name=orders-cli
```

### 清空队列消息

```bash
$ docker exec hello-mq-rabbit-1 rabbitmqctl purge_queue orders-cli
Purged 0 messages from queue 'orders-cli'
```

## 生产消息

**RabbitMQ 镜像内没有原生 CLI 可以发送消息**。从宿主机使用 curl 调用 management API：

```bash
# 宿主机执行
curl -u guest:guest -X POST \
    http://localhost:15672/api/exchanges/default/publish \
    -H "content-type: application/json" \
    -d '{
        "routing_key": "orders.cli",
        "properties": {
            "delivery_mode": 2
        },
        "payload": "order-cli-1",
        "payload_encoding": "string"
    }'
```

**响应**：`{"routed":true}`

## 消费消息

**从宿主机调用 GET API**（取走消息即确认）：

```bash
# 第一次 GET 返回第 1 条
curl -u guest:guest \
    http://localhost:15672/api/queues/%2F/orders-cli/get?count=1

[{"routing_key":"orders.cli","properties":{...},"payload":"..."},...]

# 第二次 GET 返回第 2 条
curl -u guest:guest \
    http://localhost:15672/api/queues/%2F/orders-cli/get?count=1
```

**响应示例**：
```json
[{"messages":[{"redelivered":false,"queue":"orders-cli","vhost":"/",...,"payload":"order-cli-2"}]}]
```

## 监控与排障

### 连接数统计

```bash
$ docker exec hello-mq-rabbit-1 rabbitmqctl list_connections name peer_host
name                            peer_host
app-client-1                      127.0.0.1
app-client-2                      127.0.0.1
```

### 交换机列表

```bash
$ docker exec hello-mq-rabbit-1 rabbitmqadmin list exchanges name
name
default
amq.direct
amq.fanout
amq.topic
```

---

**参考证据**：`demos/rabbitmq/cli-tools/` 中的 `bin-list.out.txt`, `status.out.txt`, `consume.out.txt`, `produce.out.txt`, `create.out.txt`, `verify.out.txt`, `assert.out.txt`。

**限制说明**：RabbitMQ 的收发能力弱于其他产品，推荐在生产中使用 Java/.NET 等 SDK，而非依赖 CLI 手工操作。
