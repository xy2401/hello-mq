---
title: 命令示例与结果
aside: false
pageClass: docker-commands-page
---

# 命令示例与结果

按案例查看实际命令、备注与执行记录；每个步骤分别保留 stdout、stderr 和退出码。 [容器内命令与文件清单](./docker-commands)。

<DockerCommands data-url="/docker-data/rabbitmq/manifest.json" mode="examples" />

案例覆盖版本、节点状态、虚拟主机、用户与权限和插件列表。每个采集批次在新的 RabbitMQ 4.1.4 / Erlang 27.3.4.3 容器中启动一次本地节点，全部案例完成或失败后停止节点；节点数据与命令记录保存在同一 `/capture` 挂载中。

[Hello MQ 采集入口](https://github.com/xy2401/hello-mq/tree/main/support/capture/rabbitmq) 支持本地 WSL2 / Podman + Compose 和手动 Actions。原始命令、输入、stdout、stderr、退出码及断言随本项目批次保存；页面回放本站证据，不在浏览器中启动消息队列。待采集、失败和通过状态由实际记录决定。

Ubuntu 26.04 LTS / linux/amd64 基线及各层镜像 ID 随批次记录，[历史 DockerTooling 结果](./DockerTooling) 继续保留。
