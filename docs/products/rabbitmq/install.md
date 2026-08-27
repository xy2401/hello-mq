# RabbitMQ 安装与切换

RabbitMQ Broker 依赖受支持的 Erlang/OTP；`rabbitmqctl`、`rabbitmq-diagnostics` 随服务端安装。Web 管理界面来自 management 插件，不是独立 Broker。

- [RabbitMQ 安装](https://www.rabbitmq.com/docs/download)
- [Erlang 兼容矩阵](https://www.rabbitmq.com/docs/which-erlang)
- [RabbitMQ 升级](https://www.rabbitmq.com/docs/upgrade)

## 推荐方式

Linux 使用 RabbitMQ 团队维护的零依赖 Erlang 与 RabbitMQ 仓库组合；Windows 使用官方安装器，macOS 可用 Homebrew。先核对 Erlang 兼容矩阵再升级任一组件。

## Broker 与 Erlang

~~~bash
# 配置 RabbitMQ 官方 Team RabbitMQ APT/RPM 仓库后
sudo apt install erlang-base rabbitmq-server
sudo dnf install erlang rabbitmq-server
# macOS，Homebrew 社区维护
brew install rabbitmq
~~~

Windows 使用 RabbitMQ 下载页链接的 Erlang 和 RabbitMQ 安装器；两者位数和版本必须匹配。

## 服务、CLI 与端口

~~~bash
systemctl status rabbitmq-server
rabbitmq-diagnostics status
rabbitmqctl version
# AMQP 5672；启用 management 后 HTTP 15672
~~~

## 版本切换

节点升级需要按官方 rolling/blue-green 流程和 feature flags 管理。Homebrew 或包管理器通常只暴露一个当前版本；并行开发实例应隔离 nodename、数据目录、cookie 与端口。

## Docker

~~~bash
docker run --rm --name rabbitmq-smoke -p 5672:5672 -p 15672:15672 rabbitmq:4.1.4-management
~~~

## 安装验证

~~~bash
rabbitmqctl version
rabbitmq-diagnostics ping
rabbitmq-diagnostics listeners
~~~

## 升级、卸载与冲突

先检查 Erlang 兼容矩阵与升级路径，再滚动升级 Broker。卸载前备份 definitions、cookie 和持久消息数据。检查 4369/5672/15672/25672 端口和 `RABBITMQ_HOME`。

## 官方资料

- [RabbitMQ 安装](https://www.rabbitmq.com/docs/download)
- [Erlang 兼容矩阵](https://www.rabbitmq.com/docs/which-erlang)
- [RabbitMQ 升级](https://www.rabbitmq.com/docs/upgrade)

资料核对日期：2026-08-27。
