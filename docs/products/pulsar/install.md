# Apache Pulsar 安装与切换

Pulsar 二进制发行包包含 Broker、BookKeeper、ZooKeeper/metadata 工具和多种 CLI。4.x 需要 Java 21；Windows 本地独立模式不是官方原生路径，使用 Docker。

- [Pulsar 下载](https://pulsar.apache.org/download/)
- [本地 standalone](https://pulsar.apache.org/docs/next/getting-started-standalone/)
- [升级 Pulsar](https://pulsar.apache.org/docs/next/administration-upgrade/)

## 推荐方式

选择正式支持的 4.2 或 4.0 LTS，不安装 5.0 milestone 作为稳定环境。macOS/Linux 可用官方 binary archive，Windows 开发用固定容器。

## JDK 与发行包

~~~bash
java -version
tar -xzf apache-pulsar-4.2.4-bin.tar.gz
cd apache-pulsar-4.2.4
bin/pulsar standalone
~~~

归档、ASC 与 SHA-512 从 Apache 下载页取得。standalone 把多个组件放在一个 JVM，只用于开发。

## CLI 与端口

~~~bash
bin/pulsar-admin brokers healthcheck
bin/pulsar-admin topics list public/default
# binary protocol 6650；HTTP 8080
~~~

## 版本切换

发行包可并行解压并以绝对路径调用 CLI；集群升级必须按 Broker、BookKeeper、proxy 等组件顺序执行，并核对元数据与客户端兼容。

## Docker

~~~bash
docker run --rm --name pulsar-smoke -p 6650:6650 -p 8080:8080 apachepulsar/pulsar:4.2.4 bin/pulsar standalone
~~~

## 安装验证

~~~bash
java -version
bin/pulsar version
bin/pulsar-admin brokers healthcheck
~~~

## 升级、卸载与冲突

升级使用新发行目录，保留配置与数据备份并遵循官方顺序。卸载前处理 BookKeeper ledger 和 metadata。检查 Java、6650/8080 端口及 `PULSAR_HOME`。

## 官方资料

- [Pulsar 下载](https://pulsar.apache.org/download/)
- [本地 standalone](https://pulsar.apache.org/docs/next/getting-started-standalone/)
- [升级 Pulsar](https://pulsar.apache.org/docs/next/administration-upgrade/)

资料核对日期：2026-08-27。
