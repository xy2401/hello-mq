# 快速开始

> 本页结论：从零完成环境准备、启动文档站，并跑通第一个 RabbitMQ 实验。

## 环境要求

| 工具 | 版本 | 用途 |
| :--- | :--- | :--- |
| Node.js | ≥ 20 | VitePress 文档站与实验入口脚本 |
| Docker Engine + Compose v2 | 近期稳定版 | Broker 容器实验 |
| JDK | ≥ 21（构建产物目标为 Java 21） | 标准 Demo |
| Maven | ≥ 3.9 | Demo 构建 |
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
npm run lab -- list              # 列出全部产品与实验
npm run lab -- rabbitmq basic    # 启动 RabbitMQ、发 3 条、收 3 条、校验断言
```

实验会自动完成（见[实验约定](/guide/lab-conventions)）：

1. 校验 `.env.versions` 中镜像锁定（禁止 `latest`，必须含 digest）。
2. 以独立 Compose Project `hello-mq-rabbitmq-basic` 启动 Broker。
3. 轮询健康检查直到就绪，不使用固定长 sleep。
4. 在宿主机运行 Java Consumer 与 Producer。
5. 输出逐条 `[assert] ... PASS/FAIL`，并写入归一化快照。
6. 成功后自动停止并删除本实验的容器、网络与卷。

## 静态检查

```bash
npm run check           # check-project + docs:build
npm run verify-outputs  # 核验已提交快照
```

## 资源与安全提示

- 所有端口仅绑定 `127.0.0.1`；管理界面不暴露公网。
- 演示账号（见 `.env.example`）**仅限本地实验，禁止用于生产**。
- `npm run lab -- <product> clean` 只清理该产品的 `hello-mq-*` Compose Project，绝不执行全局 `docker prune`。

## 下一步

- 理解概念：[基础原理](/fundamentals/)
- 动手实验：[实验室总览](/labs/)
- 产品学习：[RabbitMQ 分卷](/brokers/rabbitmq/)
