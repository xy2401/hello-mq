---
title: 容器内命令
aside: false
pageClass: docker-commands-page
---

# 容器内命令

按安装目录、发行包文件表和镜像阶段差异查看命令归属；完整文件清单包含非可执行文件、目录、权限、大小和哈希。[命令示例与结果](./docker-command-ops)。

<DockerCommands data-url="/docker-data/rabbitmq/manifest.json" mode="catalog" />

镜像按 Ubuntu 26.04 LTS / linux/amd64 → Erlang 27.3.4.3 → RabbitMQ 4.1.4 分层构建，分别采集每层的完整文件清单，生成相邻阶段和总差异。Erlang 与 apt 编译依赖单独归属，不计为 RabbitMQ 产品命令。

安装配方、采集批次和展示包由 [Hello MQ](https://github.com/xy2401/hello-mq/tree/main/support/capture/rabbitmq) 维护；公共 Ubuntu 基线和采集脚本来自 Hello Docker。本地 WSL2 使用 Podman + Compose 构建并真实采集，也可手动运行 Actions。页面只读取本站校验后的展示包；采集是否完成及案例是否通过，以面板中的批次状态为准。

[历史 DockerTooling 证据](./DockerTooling) 保留原镜像和版本信息。
