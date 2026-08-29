---
title: MQ 交互回放实验台
description: 回放 RabbitMQ、Kafka 与 Redis Streams 的真实 Docker 实验证据
aside: false
pageClass: mq-playground-page
---

# MQ 交互回放实验台

选择产品和场景，按真实 Docker 证据逐步观察消息所在位置、Broker 指标、消费者状态与业务写入。网页只恢复已采集状态；没有证据支持的操作不会出现，也不会由浏览器推演结果。

<MqPlayground />

证据由 `demos/<product>/<scenario>/run.sh` 产生，原始角色日志、Broker 检查点、最终断言和镜像 digest 一并提交。普通文档构建只校验这些文件，不启动 Broker。
