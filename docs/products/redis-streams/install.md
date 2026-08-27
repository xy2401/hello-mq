# Redis Streams 安装与切换

Redis Streams 是 Redis Server 自带的数据类型与命令集，不是独立 Broker、软件包或守护进程。安装服务端和 `redis-cli` 即可获得 Streams。

- [Redis Open Source 安装](https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/)
- [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/)
- [Redis 管理](https://redis.io/docs/latest/operate/oss_and_stack/management/)

## 推荐方式

按 Redis 官方安装页部署 Redis 8.x；Windows 开发使用 Docker/WSL。不要搜索或安装名为 `redis-streams-server` 的第三方包。

## 安装 Redis Server 与 CLI

~~~bash
# 配置 Redis 官方仓库后
sudo apt install redis
sudo yum install redis
brew tap redis/redis
brew install --cask redis
~~~

发行版包和 Homebrew 由相应维护者更新。Streams 客户端功能由所选语言的 Redis driver 提供，不属于 Broker 安装。

## 服务与 Streams 能力

~~~bash
redis-server --version
redis-cli -h 127.0.0.1 -p 6379 ping
redis-cli -h 127.0.0.1 -p 6379 XADD smoke-stream * message hello
redis-cli -h 127.0.0.1 -p 6379 XRANGE smoke-stream - +
~~~

## 版本切换

Streams 没有独立版本可切换；它跟随 Redis Server。并行 Redis 版本使用不同端口和数据目录，升级前检查 RDB/AOF、消费组语义和客户端兼容。

## Docker

~~~bash
docker run --rm --name redis-streams-smoke -p 6379:6379 redis:8.2.1
~~~

## 安装验证

~~~bash
redis-server --version
redis-cli INFO server
redis-cli COMMAND INFO XADD XREADGROUP
~~~

## 升级、卸载与冲突

由 Redis 的安装渠道升级卸载。持久化数据、消费组和 pending entries 都属于 Redis 数据集；备份和迁移不能只关注 Streams key。检查 6379 端口和连接 URL。

## 官方资料

- [Redis Open Source 安装](https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/)
- [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/)
- [Redis 管理](https://redis.io/docs/latest/operate/oss_and_stack/management/)

资料核对日期：2026-08-27。
