# Apache Kafka 安装与切换

Kafka 二进制发行包包含 Broker 与管理 CLI。Kafka 4.3 运行本地二进制需要 Java 17+；官方还提供 JVM 和 GraalVM Native 两类容器镜像。

- [Kafka 快速开始](https://kafka.apache.org/quickstart/)
- [Kafka 下载](https://kafka.apache.org/community/downloads/)
- [Kafka 升级](https://kafka.apache.org/documentation/#upgrade)

## 推荐方式

开发机下载并校验 Apache 官方二进制包，生产环境固定受支持版本并遵循 KRaft 部署与升级文档。系统包管理器中的 Kafka 多为社区维护，不作为本页主路径。

## JDK 与二进制包

~~~bash
java -version
tar -xzf kafka_2.13-4.3.1.tgz
cd kafka_2.13-4.3.1
KAFKA_CLUSTER_ID="$(bin/kafka-storage.sh random-uuid)"
bin/kafka-storage.sh format --standalone -t "$KAFKA_CLUSTER_ID" -c config/server.properties
bin/kafka-server-start.sh config/server.properties
~~~

下载包、ASC 与 SHA-512 均从 Apache 下载页取得；不要使用 milestone 或 snapshot。

## CLI 与端口

~~~bash
bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092
bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
~~~

## 版本切换

不同 Kafka 发行包可并行解压，通过绝对路径选择 CLI；Broker 升级必须遵循官方升级说明和元数据版本规则，不能让旧二进制随意打开已升级日志。

## Docker

~~~bash
docker run --rm --name kafka-smoke -p 9092:9092 apache/kafka:4.3.1
~~~

## 安装验证

~~~bash
java -version
bin/kafka-topics.sh --version
bin/kafka-broker-api-versions.sh --bootstrap-server localhost:9092
~~~

## 升级、卸载与冲突

新增目录完成升级和回归后再切换服务；旧目录保留到回滚窗口结束。检查 Java 版本、9092 端口、`KAFKA_HEAP_OPTS`、日志目录和脚本是否来自同一 Kafka 发行包。

## 官方资料

- [Kafka 快速开始](https://kafka.apache.org/quickstart/)
- [Kafka 下载](https://kafka.apache.org/community/downloads/)
- [Kafka 升级](https://kafka.apache.org/documentation/#upgrade)

资料核对日期：2026-08-27。
