# 快速开始

> 本页结论：从零完成环境准备、启动文档站，并跑通第一个 RabbitMQ 实验。

## 环境要求

| 工具 | 版本 | 用途 |
| :--- | :--- | :--- |
| Node.js | ≥ 20 | VitePress 文档站 |
| Docker Engine + Compose v2 | 近期稳定版 | 实验编排（broker 与 producer/consumer 全在容器内） |
| JDK | ≥ 21（构建产物目标为 Java 21） | 标准 Demo |
| Maven | ≥ 3.9 | Demo 构建（run.sh 在 jar 缺失时自动触发） |
| 内存 / 磁盘 | ≥ 4 GB / ≥ 10 GB | 单产品实验建议值 |

## 安装与文档站

```bash
npm install
npm run docs:dev      # 开发模式
npm run docs:build    # 生产构建
npm run docs:preview  # 预览构建产物
```

## 第一个实验：rabbitmq basic

```bash
bash demos/rabbitmq/basic/run.sh    # 启动 RabbitMQ、发 3 条、收 3 条、校验断言
```

实验会自动完成（见[实验约定](/reference/lab-conventions)）：

1. jar 缺失时先构建 Demo（`mvn package`）。
2. 以独立 Compose Project `hello-mq-rabbitmq-basic` 启动完整流程；broker 健康后由 `depends_on` 依次驱动 setup → producer → consumer → inspect-db。
3. 各角色日志落到实验目录 `<服务>.out.txt`，断言逐条写入 `assert.out.txt`（PASS/FAIL）。
4. 结束后（含失败路径）自动 `docker compose down --volumes`，只清理本实验的容器、网络与卷。

## 静态检查

```bash
npm run check           # check-project + docs:build
```

## 资源与安全提示

- 所有端口仅绑定 `127.0.0.1`；管理界面不暴露公网。
- 演示账号（见 `demos/.env.example`）**仅限本地实验，禁止用于生产**。
- run.sh 退出时的清理只作用于本实验的 `hello-mq-*` Compose Project，绝不执行全局 `docker prune`。

## 下一步

- 理解概念：[基础原理](/#mq-fundamentals)
- 动手实验：[实验台总览](/playground/)
- 产品学习：[RabbitMQ 分卷](/products/rabbitmq/)
