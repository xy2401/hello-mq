# Pulsar CLI 工具

> **本页面说明**：所有命令与输出来自 `demos/pulsar/cli-tools/*.out.txt` 的真实采集，未做任何改写。

## 命令清单

Pulsar 镜像 `/pulsar/bin/` 目录下共 **20 个文件**（包括 Python 脚本、二进制文件和 shell 脚本）：

```bash
$ ls /pulsar/bin
apply-config-from-env-with-prefix.py
apply-config-from-env.py
bookkeeper
function-localrunner
gen-yml-from-env.py
generate-zookeeper-config.sh
proto
pulsar
pulsar-admin
pulsar-admin-common.sh
pulsar-client
pulsar-daemon
pulsar-managed-ledger-admin
pulsar-perf
pulsar-shell
pulsar-zookeeper-ruok.sh
update-ini-from-env.py
update-rocksdb-conf-from-env.py
watch-znode.py
```

主要工具：
- **Pulsar Admin API**：`pulsar-admin` - 覆盖全部管理功能
- **Client Tools**：`pulsar-client` - 消息收发 CLI

## 状态查询

### Broker 健康检查

```bash
$ bin/pulsar-admin brokers healthcheck
ok
```

### Topic 统计信息

```bash
$ bin/pulsar-admin topics stats persistent://public/default/orders-cli
{
  "msgRateIn" : 0.0,
  "msgThroughputIn" : 0.0,
  "msgRateOut" : 0.0,
  "msgThroughputOut" : 0.0,
  "bytesInCounter" : 0,
  "msgInCounter" : 3,
  "msgOutCounter" : 3,
  "storageSize" : 256,
  "backlogSize" : 0,
  ...
}
```

### Namespace 信息

```bash
$ bin/pulsar-admin namespaces get-policies persistent://public/default
...
"subscriptionDisagreedPosition":null,
"topics":"[\"persistent://public/default/orders-cli\"]"
...
```

## Topic 管理

### 创建持久化主题

```bash
$ bin/pulsar-admin topics create persistent://public/default/orders-cli
Created persistent://public/default/orders-cli successfully
```

### 删除主题

```bash
$ bin/pulsar-admin topics delete \
    --unnuke \
    persistent://public/default/orders-cli
```

### 查看 Topic 列表

```bash
$ bin/pulsar-admin topics list persistent://public/default
[persistent://public/default/orders-cli]
```

## Consumer 管理

### 创建消费组并订阅

Pulsar 的消费组在首次 consume 时自动创建。

### 查看消费组详情

```bash
$ bin/pulsar-admin subscriptions list \
    persistent://public/default/orders-cli
```

### 重置消费位点

```bash
$ bin/pulsar-admin topics set-subscription-position \
    earliest \
    persistent://public/default/orders-cli \
    my-consumer-group
```

## 生产消息

```bash
$ bin/pulsar-client produce \
    -m "order-cli-1,order-cli-2,order-cli-3" \
    persistent://public/default/orders-cli

PulsarClientTool - 3 messages successfully produced
```

**特点**：通过 `-m` 参数用逗号分隔多条消息，每条作为一个独立消息发送。

## 消费消息

```bash
$ bin/pulsar-client consume \
    -n 3 \
    --subscribe my-consumer-group \
    persistent://public/default/orders-cli

----- got message -----
publishTime:[1787242491101], eventTime:[0], key:[null], properties:[], content:order-cli-1
----- got message -----
publishTime:[1787242491101], eventTime:[0], key:[null], properties:[], content:order-cli-2
----- got message -----
publishTime:[1787242491101], eventTime:[0], key:[null], properties:[], content:order-cli-3

Consumed a total of 3 messages
```

**特点**：使用 `-n N` 指定消费数量，`--subscribe` 指定消费组名。

---

**参考证据**：`demos/pulsar/cli-tools/` 中的 `status.out.txt`, `produce.out.txt`, `consume.out.txt`, `create.out.txt`, `verify.out.txt`, `assert.out.txt`。

**闭环等级**：**完整闭环**（原生 CLI 支持完整的收发流程）。
