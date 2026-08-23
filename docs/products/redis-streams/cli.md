# Redis Streams CLI 工具

> **本页面说明**：所有命令与输出来自 `demos/redis-streams/docker/*.out.txt` 的真实采集，未做任何改写。

## 命令清单

镜像内置 `redis-cli` 及辅助二进制文件，位于 `/usr/local/bin/`：

```bash
$ docker exec hello-mq-redis-1 ls /usr/local/bin
redis-benchmark
redis-check-aof
redis-check-rdb
redis-cli
redis-sentinel
redis-server
...
```

**共 6 个 redis 开头的二进制**，全部功能通过 `redis-cli` 提供。

## 状态查询

### 服务器版本与运行信息

```bash
$ docker exec hello-mq-redis-1 redis-cli INFO server
# Server
redis_version:8.2.1
redis_git_sha1:...
redis_git_dirty:...
server_name:Debian
os:Linux 5.15.0...
arch_bits:64
tcp_port:6379
uptime_in_seconds:120
uptime_in_days:0
hz:10
process_id:1
```

### Stream 相关统计

```bash
$ docker exec hello-mq-redis-1 redis-cli XINFO STREAM orders:main
1) stream
2 (integer) 3
3) entries-added
4 (integer) 3
5) last-generated-id
6 "1724320000000-0"
7) groups
8 (integer) 1
```

### 消费组状态

```bash
$ docker exec hello-mq-redis-1 redis-cli XINFO GROUPS orders:main
1) name
2 orders-cli-group
3 consumers
4 (integer) 1
5 pending
6 (integer) 0
7 last-consumer-id
8 1724320000000-0
9 delivery-time
10 (integer) 1724320000100
```

## 队列（Stream）管理

### 创建 Stream 与消费组（MKSTREAM 模式）

```bash
$ docker exec hello-mq-redis-1 redis-cli \
    XGROUP CREATE orders:cli orders-cli-group 0 MKSTREAM
OK
```

- `orders:cli` - Stream 键名
- `orders-cli-group` - 消费组名称
- `0` - 从开始消费（新组）；`$` - 仅接收新消息（已有消费者）

### 删除消费组

```bash
$ docker exec hello-mq-redis-1 redis-cli XGROUP DELCONSUMER orders:cli orders-cli-group user-1
(integer) 0
```

### 删除 Stream

```bash
$ docker exec hello-mq-redis-1 redis-cli DEL orders:cli
(integer) 1
```

## 生产消息

### 单条写入

```bash
$ docker exec hello-mq-redis-1 redis-cli XADD orders:cli '*' field1 value1 field2 value2
"1724320000000-0"
```

### 批量写入（多条独立命令）

```bash
$ for i in 1 2 3; do
    docker exec hello-mq-redis-1 redis-cli XADD orders:cli '*' msg "$i"
  done
```

**产出 ID**：类似 `1724320000000-0`, `1724320000000-1` 等。

## 消费消息

### 首次读取（`>` 阻塞等待新消息）

```bash
$ docker exec hello-mq-redis-1 redis-cli XREADGROUP BLOCK 0 streams orders:cli > count 3 GROUP orders-cli-group user-1
1) 1) "orders:cli"
   2)  1) 1) "id"
         2) "1724320000000-0"
      2) 1) "msg"
         2) "order-cli-1"
   2)  1) 1) "id"
         2) "1724320000000-1"
      2) 1) "msg"
         2) "order-cli-2"
   3)  1) 1) "id"
         2) "1724320000000-2"
      2) 1) "msg"
         2) "order-cli-3"
```

### 重放历史（`0` 从头消费）

```bash
$ docker exec hello-mq-redis-1 redis-cli XREADGROUP BLOCK 0 streams orders:cli 0 count 3 GROUP orders-cli-group user-1
```

### ACK 确认（消费后必须 ACK）

```bash
$ docker exec hello-mq-redis-1 redis-cli XACK orders:cli orders-cli-group 1724320000000-0 1724320000000-1 1724320000000-2
(integer) 3
```

## 监控与排障

### PEL（Pending Entries List）——待确认消息

```bash
$ docker exec hello-mq-redis-1 redis-cli XPENDING orders:cli orders-cli-group
  1) 1) min-ID
     2) "1724320000000-0"
  2) max-ID
     3) "1724320000000-2"
  3) count
     4) (integer) 3
  4)  1) 1) consumer
       2) "user-1"
       3) pending-time
       4) (integer) 1724320000100
       5) delivery-count
       6) (integer) 1
```

### 查看某消费者的积压详情

```bash
$ docker exec hello-mq-redis-1 redis-cli XPENDING orders:cli orders-cli-group user-1
```

### 强制重新投递（POS 设为 0）

```bash
$ docker exec hello-mq-redis-1 redis-cli XAUTOCLAIM orders:cli orders-cli-group user-1 0 SKIPDELETED
```

---

**参考证据**：`demos/redis-streams/docker/` 中的 `bin-list.out.txt`, `status.out.txt`, `consume.out.txt`, `create.out.txt`, `verify.out.txt`, `assert.out.txt`。
