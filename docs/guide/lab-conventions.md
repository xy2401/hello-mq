# 实验约定

> 本页结论：所有实验遵循统一的生命周期、命名、断言与安全规则，保证可重复、可验证、不误伤环境。

## 统一命令接口

```bash
npm run lab -- list                    # 列出产品与实验
npm run lab -- rabbitmq basic          # 运行单个实验
npm run lab -- rabbitmq all            # 运行某产品全部 L1/L2 实验
npm run lab -- rabbitmq clean          # 清理该产品实验资源
npm run collect-outputs -- rabbitmq    # 重跑并刷新快照
npm run verify-outputs                 # 核验已提交快照
```

## 实验生命周期

`scripts/lab.js` 对每个实验执行固定十步（对应规格 §9.4）：

1. 校验产品名、实验名与危险等级（L1/L2 默认执行；L3/L4 不在本期）。
2. 解析 `.env.versions`，拒绝未锁定的 `latest` 镜像；核心镜像必须含 digest。
3. 使用项目名隔离的 Compose Project 启动目标产品。
4. 轮询产品健康检查（2 秒间隔、90 秒超时），不使用固定长 sleep。
5. 创建 Queue/Exchange/Binding 等实验资源（由 Java 客户端声明）。
6. 先启动 Consumer，再运行 Producer；特殊实验按声明编排。
7. 收集客户端输出与 Broker 诊断信息（`rabbitmqctl list_queues` 等）。
8. 运行断言，逐条输出 `[assert] <name>=<value> PASS|FAIL`。
9. 正常路径自动停止容器；失败时保留诊断信息并输出 compose logs 提示。
10. 清理范围仅限当前 Compose Project 与带项目前缀的资源。

## 命名与隔离

- Compose Project：`hello-mq-<product>-<lab>`（如 `hello-mq-rabbitmq-basic`）。
- 队列/交换机名由实验声明，清理只按项目名前缀匹配。
- Producer/Consumer 以宿主机 JVM 进程运行（非容器）：崩溃注入可确定性触发（观察退出码 137），stdout 直接捕获，无需维护客户端镜像。Broker 始终在容器内。

## 断言规则

禁止仅用“进程退出码为 0”代表实验成功。每个实验至少断言业务级指标：

- 生产端确认的消息数量（Publisher Confirms）。
- 消费端收到的消息数量与唯一 `messageId` 数量。
- 业务落库行数（幂等表去重后的真实写入）。
- 重投递次数或 delivery attempt。
- Broker 状态：队列深度、DLQ 消息数（经 `rabbitmqctl --formatter=json`）。
- **失败注入确实发生**：崩溃实验必须观察到退出码 137，而不是“测试路径没有触发”。

## 快照规则

- 快照写入 `outputs/<product>/<lab>.snapshot`，frontmatter 含产品、实验、Broker 版本、镜像（tag@digest）、客户端版本、耗时、退出码与断言值。
- 正文经 `scripts/normalize-output.js` 归一化：时间戳、动态 Message ID、容器名后缀、主机路径、ANSI 颜色全部替换为稳定占位符；归一化必须幂等。
- 普通运行与已提交快照比较断言数值；`collect` 显式刷新快照（升级镜像或客户端时必须走此流程并审查语义变化）。

## 安全规则

- 所有 Broker 端口仅绑定 `127.0.0.1`。
- 停止/删除只作用于本 Compose Project 已解析出的资源；不使用 Docker 全局 prune。
- 删除数据卷需显式确认（本期实验随 `down --volumes` 清理命名卷，无全局影响）。
- `.env.example` 中的演示凭据仅限本地。

## 实验分级（本期范围）

| 等级 | 类型 | 本期 |
| :--- | :--- | :--- |
| L1 | 单节点冒烟：启动、发 3 条、收 3 条、校验 | ✅ basic、routing |
| L2 | 可靠性行为：重投、DLQ、幂等 | ✅ consumer-crash、retry-dlq |
| L3/L4 | 多节点故障 / 性能容量 | 不在本期 |
