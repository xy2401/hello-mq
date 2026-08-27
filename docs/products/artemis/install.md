# ActiveMQ Artemis 安装与切换

Artemis 的发行目录（`ARTEMIS_HOME`）与用 `artemis create` 生成的 Broker 实例目录必须分开；升级时通常替换发行目录而保留实例数据与配置。

- [ActiveMQ Artemis 下载](https://activemq.apache.org/components/artemis/download/)
- [使用服务器](https://activemq.apache.org/components/artemis/documentation/latest/using-server.html)
- [升级指南](https://activemq.apache.org/components/artemis/documentation/latest/versions.html)

## 推荐方式

下载 Apache 官方 binary archive 并校验签名；先安装页面要求的 JDK。为每个 Broker 创建独立实例目录，不要在发行包目录内直接存生产数据。

## JDK、发行包与实例

~~~bash
java -version
tar -xzf apache-artemis-2.44.0-bin.tar.gz
./apache-artemis-2.44.0/bin/artemis create "$HOME/artemis-instance" --user admin --password localtest --allow-anonymous
"$HOME/artemis-instance/bin/artemis" run
~~~

Windows 使用同版本 ZIP 和 `.cmd` 脚本。`--allow-anonymous` 仅适合回环地址开发验证。

## CLI 与端口

~~~bash
$HOME/artemis-instance/bin/artemis check node
# Core/AMQP 默认 61616；Web 控制台默认 8161
~~~

## 版本切换

安装新 `ARTEMIS_HOME`，停止实例，按升级文档审查配置后让实例脚本引用新发行目录。不要在同一 journal 上来回切换不兼容版本；JDK 基线也必须同步。

## Docker

~~~bash
docker run --rm --name artemis-smoke -e ARTEMIS_USER=admin -e ARTEMIS_PASSWORD=localtest -p 61616:61616 -p 8161:8161 apache/activemq-artemis:2.44.0
~~~

## 安装验证

~~~bash
java -version
$HOME/artemis-instance/bin/artemis version
$HOME/artemis-instance/bin/artemis check node
~~~

## 升级、卸载与冲突

保留实例目录备份，使用新发行目录升级。卸载前先删除系统服务，再决定是否保留 data/journal。检查 `ARTEMIS_HOME`、实例脚本、61616/8161 端口和 JDK。

## 官方资料

- [ActiveMQ Artemis 下载](https://activemq.apache.org/components/artemis/download/)
- [使用服务器](https://activemq.apache.org/components/artemis/documentation/latest/using-server.html)
- [升级指南](https://activemq.apache.org/components/artemis/documentation/latest/versions.html)

资料核对日期：2026-08-27。
