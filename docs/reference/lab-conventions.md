# 实验约定

> 本页结论：所有实验遵循统一的生命周期、命名、断言与安全规则，保证可重复、可验证、不误伤环境。

## 统一命令接口

每个实验一个自包含目录（`demos/<product>/<lab>/`），内含完整流程的 `docker-compose.yml` 与薄封装的 `run.sh`：

```bash
bash demos/rabbitmq/basic/run.sh                # 运行单个实验（jar 缺失时自动 mvn 构建）
for s in demos/*/*/run.sh; do bash "$s"; done   # 全量运行
npm run check:compose                           # 仅静态校验全部 compose 文件
```

## 实验生命周期

编排完全由 compose 语义表达（`depends_on` 的 `service_healthy` / `service_completed_successfully`），run.sh 只做编排之外的事：

1. `ensure_jar`：jar 缺失时才触发 Maven 构建。
2. `docker compose up`：启动 broker → setup → producer → consumer → inspect-db 完整链路；健康等待由 `service_healthy` 条件承担，无固定长 sleep。
3. `collect_logs`：每个服务的日志分别落到实验目录 `<服务>.out.txt`（如 `producer.out.txt`、`consumer.out.txt`）。
4. `assert_eq` 断言：grep/jq 解析日志与 broker 状态，逐条写入 `assert.out.txt`（`PASS|FAIL`）。
5. trap EXIT 清理：`docker compose down --volumes --remove-orphans`，仅限本实验 Compose Project。

多阶段实验（如崩溃注入、积压度量）在 run.sh 中分阶段 `compose up -d <子集>`，其余仍由 compose 依赖链保证顺序。

## 命名与隔离

- Compose Project：`hello-mq-<product>-<lab>`（如 `hello-mq-rabbitmq-basic`）。
- 队列/交换机/Topic 名由实验声明，清理只按项目名前缀匹配。
- Producer/Consumer 也是 compose 服务：digest 锁定的 JRE 镜像挂载本机构建的 jar 与共享 fixture 运行；崩溃注入由容器内 `halt(137)` 触发，退出码经 `docker inspect` 读取。

## 断言规则

禁止仅用“进程退出码为 0”代表实验成功。每个实验至少断言业务级指标：

- 生产端确认的消息数量（Publisher Confirms）。
- 消费端收到的消息数量与唯一 `messageId` 数量。
- 业务落库行数（幂等表去重后的真实写入）。
- 重投递次数或 delivery attempt。
- Broker 状态：队列深度、DLQ 消息数（经 `rabbitmqctl --formatter=json`）。
- **失败注入确实发生**：崩溃实验必须观察到退出码 137，而不是“测试路径没有触发”。

## 输出日志规则

- 每次实验结束后，各角色日志写入实验目录 `demos/<product>/<lab>/<服务>.out.txt`，断言结果写入同目录 `assert.out.txt`。
- 日志不做归一化处理，每次重跑会覆盖旧文件；重跑即刷新。
- 文档站 `<LabOutput>` 组件按角色分块渲染对应日志文件，页面只保留复现命令与日志现场。

## 安全规则

- 所有 Broker 端口仅绑定 `127.0.0.1`。
- 停止/删除只作用于本 Compose Project 已解析出的资源；不使用 Docker 全局 prune。
- 删除数据卷需显式确认（本期实验随 `down --volumes` 清理命名卷，无全局影响）。
- `demos/.env.example` 中的演示凭据仅限本地。

## 实验分级（本期范围）

| 等级 | 类型 | 本期 |
| :--- | :--- | :--- |
| L1 | 单节点冒烟：启动、发 3 条、收 3 条、校验 | ✅ basic、routing |
| L2 | 可靠性行为：重投、DLQ、幂等 | ✅ consumer-crash、retry-dlq |
| L3/L4 | 多节点故障 / 性能容量 | 不在本期 |
