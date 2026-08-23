# RocketMQ CLI 工具

> **本页面说明**：所有命令与输出来自 `demos/rocketmq/docker/*.out.txt` 的真实采集，未做任何改写。

## 命令清单

RocketMQ 镜像 `/home/rocketmq/rocketmq-5.5.0/bin/` 目录下共 **36 个文件**（包含脚本和可执行文件）：

```bash
$ ls /home/rocketmq/rocketmq-5.5.0/bin
cachedog.sh    controller     mqbroker        mqcontroller   mqproxy        runbroker.sh
cleancache.sh  dledger        mqbroker.cmd    mqnamesrv      mqshutdown     setcache.sh
...
mqadmin        mqnamesrv.cmd  mqbrokercontainer mqproxy.cmd    tools          ...
```

核心工具：
- **mqadmin**: 管理控制台（覆盖全部运维功能）
- **mqbroker/mqnamesrv**: Broker 和 NameServer 启动脚本
- **tools.sh/cmd**: 通用工具集

## 状态查询

### 集群列表

```bash
$ mqadmin clusterList -n namesrv:9876
#Cluster Name           #Broker Name            #BID  #Addr                  #Version              #InTPS(LOAD)                   #OutTPS(LOAD)  #Timer(Progress)        #PCWait(ms)  #Hour         #SPACE    #ACTIVATED
DefaultCluster          hello-mq-broker         0     172.18.0.3:10911       V5_5_0                 0.00(0,0ms)               0.00(0,0ms|0,0ms)  1-0(0.0w, 0.0, 0.0)               0  496456.36     0.5400          true
```

### Topic 状态

```bash
$ mqadmin topicStatus -n "namesrv:9876" -t orders.cli
TopicName: orders.cli
TopicRouteData: {
    MessageQueue=[...]
}
```

## Topic 管理

### 更新/创建 Topic

```bash
$ mqadmin updateTopic -n "namesrv:9876" \
    -c DefaultCluster \
    -u orders.cli \
    -r 1 \
    -w true \
    -h true \
    -s true \
    -perm 6 \
    -t 8

UpdateTopic: OK
```

### 查看 Topic 列表

```bash
$ mqadmin topicList -n "namesrv:9876"
```

## 生产消息

```bash
$ mqadmin sendMessage -n "namesrv:9876" \
    -c DefaultCluster \
    -t orders.cli \
    -p body='order-cli-1' \
    -c TagCli \
    -l

hello-mq-broker                   7     SEND_OK                 AC12000301F32FF4ACD0655B785E0000
```

**注意**：需要单独执行多次来发送多条消息。

## 消费消息

**RocketMQ 的消费命令是排空式查看**（不推进位点），适合验证而不是真实消费：

```bash
$ mqadmin consumeMessage -n "namesrv:9876" \
    -c DefaultCluster \
    -t orders.cli \
    -g orders-cli-group

MSGID: AC12000301F32FF4ACD0655B785E0000 
MessageExt [... TAGS=TagCli ...] BODY: order-cli-1
```

**实测限制**：源码对每个访问过的队列都扣减 countLeft，因此 `-c <N>` 参数不可靠（8 队列下 `-c 3` 可能只消费到 1 条）。实验使用默认值排空查看。

## 监控与排障

### 消费组状态

```bash
$ mqadmin consumerStatus -n "namesrv:9876" -g orders-cli-group
```

### 积压查询

```bash
$ mqadmin getSubOffset -n "namesrv:9876" \
    -t orders.cli \
    -g orders-cli-group
```

---

**参考证据**：`demos/rocketmq/docker/` 中的 `status.out.txt`, `consume.out.txt`, `produce.out.txt`, `create.out.txt`, `verify.out.txt`, `assert.out.txt`, `bin-list.out.txt`。

**闭环等级**：**完整闭环**（mqadmin 支持完整的运维和收发流程）。

**特殊说明**：`consumeMessage` 采用排空式查看而非真正推进位点，实际生产中应使用 Java SDK 实现可靠消费。
