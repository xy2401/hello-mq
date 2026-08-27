# ActiveMQ Classic 安装与切换

ActiveMQ Classic 以二进制归档交付，Broker、管理脚本和 Web 控制台在同一发行包中。6.3.x 需要 Java 25+；5.19.x 是仍受支持且 Java 基线更低的并行系列。

- [ActiveMQ Classic 下载](https://activemq.apache.org/components/classic/download/)
- [安装说明](https://activemq.apache.org/components/classic/documentation/installation)
- [版本升级](https://activemq.apache.org/components/classic/documentation/versions)

## 推荐方式

根据现有 JDK 和客户端兼容性选择官方支持系列，下载 binary distribution 而非 source release，并校验 ASC/SHA-512。生产不要直接以仓库示例配置开放控制台。

## JDK 与发行包

~~~bash
java -version
tar -xzf apache-activemq-6.3.1-bin.tar.gz
cd apache-activemq-6.3.1
bin/activemq start
bin/activemq status
~~~

Windows 使用同版本 ZIP 与 `bin\activemq.bat`。macOS 的 Homebrew formula 属于社区维护，版本可能与 Apache 当前稳定版不同。

## 端口

OpenWire 默认 61616，Web 控制台默认 8161；其他协议端口取决于 `conf/activemq.xml`。先限制监听地址和凭据，再开放网络。

## 版本切换

发行包可并行解压，通过服务脚本指向目标 `ACTIVEMQ_HOME`。升级 Broker 时复制并审查配置，不要覆盖合并目录；数据存储格式、JDK 与客户端兼容性必须一起验证。

## Docker

~~~bash
docker run --rm --name activemq-classic-smoke -p 61616:61616 -p 8161:8161 apache/activemq-classic:6.2.0
~~~

镜像使用仓库已锁定验证的 6.2.0；本机新装应先查看 Apache 下载页当前受支持的 6.3.x/5.19.x。

## 安装验证

~~~bash
java -version
bin/activemq status
curl -fsS http://127.0.0.1:8161/
~~~

## 升级、卸载与冲突

升级采用新目录，迁移配置、凭据和持久化数据后回归。卸载就是停止服务并移除发行目录，但数据目录和系统服务需单独处理。检查 `JAVA_HOME`、61616/8161 端口和多个服务定义。

## 官方资料

- [ActiveMQ Classic 下载](https://activemq.apache.org/components/classic/download/)
- [安装说明](https://activemq.apache.org/components/classic/documentation/installation)
- [版本升级](https://activemq.apache.org/components/classic/documentation/versions)

资料核对日期：2026-08-27。
