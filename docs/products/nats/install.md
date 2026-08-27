# NATS / JetStream 安装与切换

NATS Server（`nats-server`）与管理客户端（`nats` CLI）是两个独立项目和安装包。JetStream 是 Server 能力，不需要另装一个 Broker。

- [NATS Server 安装](https://docs.nats.io/running-a-nats-service/introduction/installation)
- [NATS Server 发布页](https://github.com/nats-io/nats-server/releases)
- [NATS CLI 发布与安装](https://github.com/nats-io/natscli)

## 推荐方式

Server 从官方 Releases 取得固定二进制或使用官方容器；CLI 单独安装。Homebrew、Scoop 与 AUR 是各自社区维护渠道，版本可能不同步。

## Server 与 CLI 分开安装

~~~bash
brew install nats-server
brew tap nats-io/nats-tools
brew install nats-io/nats-tools/nats
# Windows CLI（Scoop 社区）
scoop bucket add extras
scoop install extras/natscli
~~~

Linux/Windows Server 推荐从 nats-io 官方 GitHub Releases 选择固定版本归档；CLI Releases 同时提供 ZIP、DEB 与 RPM。

## 启动与端口

~~~bash
nats-server --jetstream
nats server check connection --server nats://127.0.0.1:4222
# client 4222；monitoring 常用 8222
~~~

## 版本切换

~~~bash
/opt/nats-server/2.11.5/nats-server -v
nats context add local --server nats://127.0.0.1:4222
nats context select local
~~~

Server 用版本化目录切换；CLI 的 context 切换连接目标，不会切换 Server 版本。JetStream 集群升级需遵循官方顺序。

## Docker

~~~bash
docker run --rm --name nats-smoke -p 4222:4222 -p 8222:8222 nats:2.11.5 -js -m 8222
~~~

## 安装验证

~~~bash
nats-server -v
nats --version
nats server check connection --server nats://127.0.0.1:4222
~~~

## 升级、卸载与冲突

Server 与 CLI 分别升级卸载。JetStream 升级前备份 store 并检查集群兼容性。排查 PATH 中两个二进制、4222/6222/8222 端口和 CLI context，避免连错环境。

## 官方资料

- [NATS Server 安装](https://docs.nats.io/running-a-nats-service/introduction/installation)
- [NATS Server 发布页](https://github.com/nats-io/nats-server/releases)
- [NATS CLI 发布与安装](https://github.com/nats-io/natscli)

资料核对日期：2026-08-27。
