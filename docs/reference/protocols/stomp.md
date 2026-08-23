# STOMP 1.2：简单文本消息协议

> 本页结论：STOMP 是面向异步消息的文本线协议，用少量 Frame 表达连接、发送、订阅、确认、事务与断开。它容易从多种语言实现和调试，但 Destination 的命名与队列/主题语义由 Broker 决定，跨 Broker 迁移不能只看 Frame 是否兼容。

## Frame 结构

```text
COMMAND
header-name:header-value
another-header:another-value

Body^@
```

Frame 由命令行、Header、空行、Body 和终止符组成。Body 含二进制数据时应提供 `content-length`，否则中间的空字节可能被当成 Frame 结束。

## 主要命令

| 客户端 Frame | 作用 |
| --- | --- |
| `CONNECT` / `STOMP` | 建立会话、协商版本和心跳 |
| `SEND` | 向 Destination 发送消息 |
| `SUBSCRIBE` | 创建订阅并选择 ACK 模式 |
| `ACK` / `NACK` | 确认或拒绝收到的消息 |
| `BEGIN` / `COMMIT` / `ABORT` | 控制协议事务 |
| `DISCONNECT` | 带 Receipt 时可确认优雅断开 |

服务端主要发送 `CONNECTED`、`MESSAGE`、`RECEIPT` 和 `ERROR`。

## 最小交互

```text
CONNECT
accept-version:1.2
host:localhost
heart-beat:10000,10000

^@
```

```text
SUBSCRIBE
id:orders-worker
destination:/queue/orders
ack:client-individual

^@
```

```text
SEND
destination:/queue/orders
content-type:application/json

{"orderId":"A-42"}^@
```

`/queue/orders` 只是常见 Broker 约定，不是 STOMP 标准规定的通用 Queue 地址。换到另一个 Broker 时，Destination 前缀、自动创建、持久订阅和死信映射都可能变化。

## ACK 模式

| 模式 | 含义 |
| --- | --- |
| `auto` | Broker 发送后即视为确认，客户端失败可能丢失 |
| `client` | ACK 可以累计确认该订阅此前的消息 |
| `client-individual` | 每条消息独立确认 |

具体重投、事务 ACK 和断线恢复能力取决于 Broker 对 STOMP 的实现。协议有对应 Frame，不代表每个实现都以相同方式映射内部队列语义。

## 什么时候使用

适合脚本语言、简单跨语言接入、人工抓包调试和浏览器 WebSocket 场景。不适合需要完整暴露某个 Broker 高级能力的客户端；此时原生协议/SDK 通常能表达更多特性。

本站映射：[ActiveMQ Artemis](/products/artemis/)与[ActiveMQ Classic](/products/activemq-classic/)均支持 STOMP 接入。

官方规范：[STOMP Protocol Specification 1.2](https://stomp.github.io/stomp-specification-1.2.html)
