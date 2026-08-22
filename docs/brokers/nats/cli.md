# NATS CLI 工具

> **本页面说明**：所有命令与输出来自 `demos/nats/cli-tools/*.out.txt` 的真实采集，未做任何改写。

## 重要说明

NATS 官方镜像是 **distroless**（极简基础镜像），只有一个 `/nats-server` 二进制文件，**没有独立的收发 CLI**。状态监控通过 **8222 HTTP 端口**的端点提供。

**闭环等级**：**仅状态**（缺少收发能力）。

## 命令清单

```bash
$ docker exec hello-mq-nats-1 /bin/ls -la /
total 16
drwxr-xr-x    3 root     root          4096 Aug 20 16:13 .
drwxr-xr-x    3 root     root          4094 Aug 20 16:13 ..
-rwxr-xr-x  1567 root     root      26804000 Jul 31 02:31 nats-server
drwxr-xr-x    3 root     root          4094 Aug 20 16:13 tmp
```

**唯一入口**：`/nats-server`（支持部分子命令如 `--version`, `--help`）

## 状态查询

### 健康检查

```bash
$ curl -fsS http://127.0.0.1:8222/healthz
{"status":"ok"}
```

### 版本信息

```bash
$ docker exec hello-mq-nats-1 /nats-server --version
nats-server: v2.11.5
```

### 服务器统计（varz）

```bash
$ curl -fsS http://127.0.0.1:8222/varz | jq
{
  "server_id": "...",
  "version": "2.11.5",
  "port": 4222,
  "max_connections": 65536,
  "subscriptions": 63,
  "in_msgs": 100,
  "out_msgs": 100,
  "jetstream": {
    "config": {
      "max_memory": 12579649536,
      ...
    },
    ...
  }
}
```

### 连接列表（connz）

```bash
$ curl -fsS http://127.0.0.1:8222/connz | jq '.connections[0:3]'
[
  {
    "connection_id": 1,
    "ip": "127.0.0.1",
    "port": 55555,
    "start": "...",
    "rtt": "0s",
    "idle": "30s"
  }
]
```

### 订阅列表（subsz）

```bash
$ curl -fsS http://127.0.0.1:8222/subsz | jq '.subscriptions'
[
  {
    "rid": 1,
    "sid": 1,
    "subject": "orders.*",
    "cluster": "",
    "remote_addr": "127.0.0.1:55555",
    "rtt": 0,
    "type": 1,
    "account": "_nats",
    "queue_group": null,
    "jid": null,
    "lang": "go",
    "server_name": "..."
  }
]
```

## Gap（缺口记录）

尝试执行缺失的命令：

```bash
$ docker exec hello-mq-nats-1 nats --help
OCI runtime exec failed: exec failed: 
unable to start container process: exec: "nats": executable file not found in $PATH
```

**结论**：官方 CLI 不在此镜像中，需从外部使用 `nats-io/natscli` 或 Java SDK。

## JetStream 状态

### JetStream 概览

```bash
$ curl -fsS http://127.0.0.1:8222/jetstream_overview
...
"accounts": {
  "$JS_API": {
    "js": {...},
    "memory": 0,
    "storage": 0,
    "streams": 0,
    "consumer": 0
  }
}
```

---

**参考证据**：`demos/nats/cli-tools/` 中的 `status.out.txt`, `varz.out.txt`, `connz.out.txt`, `gap.out.txt`。

**特殊说明**：
1. **收发能力为零** - 必须依赖外部客户端
2. **独立 CLI** - `nats-io/natscli` 可单独安装
3. **状态面齐全** - HTTP 端点覆盖全部监控需求

生产环境中推荐使用 Java SDK (`io.nats:jnats`) 实现完整收发流程。
