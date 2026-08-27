# Apache RocketMQ 安装与切换

RocketMQ 由 NameServer、Broker、Proxy 和 CLI 工具组成。官方同时发布 source 与 binary 包；本地验证应优先 binary 包或固定容器，生产部署需要明确拓扑。

- [RocketMQ 下载](https://rocketmq.apache.org/download/)
- [本地快速开始](https://rocketmq.apache.org/docs/quick-start/)
- [部署说明](https://rocketmq.apache.org/docs/deploymentOperations/01deploy/)

## 推荐方式

选择正式发布的 5.5.0 binary 包并校验，准备官方要求的 64 位 JDK。不要用源码构建流程替代普通安装，也不要把单 Broker quick start 当生产配置。

## JDK 与二进制包

~~~bash
java -version
unzip rocketmq-all-5.5.0-bin-release.zip
cd rocketmq-all-5.5.0-bin-release
nohup sh bin/mqnamesrv &
nohup sh bin/mqbroker -n localhost:9876 --enable-proxy &
~~~

Windows 不是官方推荐的服务端平台；本地开发使用 WSL、Linux VM 或容器。

## CLI 与端口

~~~bash
export NAMESRV_ADDR=localhost:9876
sh bin/mqadmin clusterList -n localhost:9876
# NameServer 9876；Broker/Proxy 端口按配置确认
~~~

## 版本切换

发行包以版本目录并行存放。集群升级必须按 NameServer/Broker/Proxy 和存储兼容规则执行；不要用 PATH 替换后直接复用未备份的 store。

## Docker

~~~bash
docker run --rm apache/rocketmq:5.5.0 sh mqadmin --version
~~~

完整烟雾集群需要 NameServer 与 Broker 两个容器；这里仅验证官方镜像中的 CLI，拓扑证据仍在“Docker 验证”。

## 安装验证

~~~bash
java -version
sh bin/mqadmin --version
sh bin/mqadmin clusterList -n localhost:9876
~~~

## 升级、卸载与冲突

升级前备份配置、commitlog/consumequeue 并核对客户端 SDK。卸载发行目录不会删除 `~/store` 与日志。检查 `JAVA_HOME`、9876/10911/8081 端口和 `NAMESRV_ADDR`。

## 官方资料

- [RocketMQ 下载](https://rocketmq.apache.org/download/)
- [本地快速开始](https://rocketmq.apache.org/docs/quick-start/)
- [部署说明](https://rocketmq.apache.org/docs/deploymentOperations/01deploy/)

资料核对日期：2026-08-27。
