# Schema 演进

> 本页结论：消息的寿命比生产它的代码长，消费者必须容忍新增的可选字段。兼容演进（只加可选字段）不升级 `schemaVersion`；破坏性变更（删字段、改类型、改语义）必须升级版本并让新旧版本共存过渡。本仓库用 `demos/shared/contracts/` 下的 JSON Schema 作为契约：v1 → v2 是一次兼容演进示例，另附一个破坏性演进反例说明什么不能直接做。

## 契约在哪里

本项目约定要求 Schema 文件放入 `demos/shared/contracts/` 并至少提供 JSON Schema：

- `order-created.v1.schema.json`：统一信封 + `order.created` 事件的首版契约；
- `order-created.v2.schema.json`：v1 的兼容演进版（本页示例，随本文档同一批创建）。

信封层（`messageId`/`eventType`/`schemaVersion` 等）由统一信封约定固定；演进主要发生在 `payload` 内。所有信封都要求 `additionalProperties: true`——**未知字段必须能通过校验并被消费者忽略**，这是兼容演进的机制基础。

## 兼容演进示例：v1 → v2

业务需求：订单要记录下单渠道与备注。v2 的做法是**只在 payload 内新增两个可选字段**：

```json
"channel": { "type": "string", "minLength": 1 },
"notes":   { "type": "string", "maxLength": 500 }
```

约束核对（对照 `order-created.v2.schema.json`）：

| 项 | v1 | v2 | 结论 |
| :--- | :--- | :--- | :--- |
| payload required | orderId / customerId / amount / currency | 不变 | 旧消息仍然合法 |
| 新增字段 | — | channel、notes，均不在 required 中 | 旧消费者收不到新字段也不报错 |
| 信封字段与 required | 11 个必填 | 完全不变 | 信封无感升级 |
| `schemaVersion` | const 1 | const 1 | 按 §5.3，破坏性变更才升版本 |
| additionalProperties | true | true | 未来字段继续兼容 |

因此：**任何能通过 v1 校验的消息（包括仓库现有 fixture `order-1001/1002/1003.json`）必然通过 v2 校验**；v2 生产者发出的带 `channel` 的消息，v1 消费者会忽略新字段正常处理。`schemaVersion` 保持 1 是刻意的——字段集兼容时升版本号会让消费者误以为必须升级解析逻辑。

v2 消息示例（仅 payload 变化）：

```json
"payload": {
  "orderId": "order-1001",
  "customerId": "customer-42",
  "amount": 199.00,
  "currency": "CNY",
  "channel": "app",
  "notes": "周末前发货"
}
```

## 破坏性演进反例：不要这样做

反例需求相同（渠道 + 金额口径调整），但做法错误：

```json
// ❌ 某团队的「order.created v2」：直接改线上契约
"payload": {
  "orderId": "order-1001",
  "customerId": "customer-42",
  "totalAmount": "19900",     // amount 改名为 totalAmount，且 number → string（分）
  "channel": "app"             // currency 被直接删除
}
```

三处破坏性变更同时发生：删必填字段（`currency`）、改名（`amount` → `totalAmount`）、改类型（number → string）。后果：

- 旧消费者按 `amount` 取值 → 空/异常；按 number 解析 → 类型错误；缺 `currency` → 入账口径错乱；
- 新旧生产者共存期间，同一 topic/队列里混着两种结构，消费者随机失败——失败看起来像「偶发抖动」，实为契约事故；
- Schema 校验失败的毒消息批量进 DLQ（见 [RabbitMQ 重试与 DLQ](/products/rabbitmq/reliability)），重试也救不回来。

正确做法（任选其一并过渡）：

1. **新事件类型**：发布 `order.created`（不变）+ 新的 `order.placed.v2` 事件，消费者逐个迁移后下线旧事件；
2. **升版本共存**：`schemaVersion: 2` 的新结构与 v1 并行发送一段时间，消费者按 `schemaVersion` 分支处理，两侧都稳定后再停发 v1；
3. **扩展-收缩**：先只加新字段（兼容）→ 消费者全部改用新字段 → 再发版移除旧字段（此时移除仍需升版本并确认无残留消费者）。

判断清单——满足任何一条即为破坏性变更：删字段、改字段名、改类型、收紧取值范围（如 string → enum）、必填化原可选字段、改变字段语义。

## 消费者与生产者的纪律

- **消费者**：反序列化必须忽略未知字段（不得用严格白名单校验整条消息）；不得对新可选字段做非空断言；升级顺序永远是「先升级消费者容忍度，再升级生产者输出」。
- **生产者**：不复用旧字段名承载新语义；新增字段给明确默认语义（缺失 = 什么含义）；发契约变更前通知所有已知订阅（[发布订阅](/reference/patterns/pub-sub)的扇出意味着下游数量容易失控）。
- **CI 把关**：契约文件的变更应触发 fixture 回归校验（本项目约定要求 JSON Schema 与 fixture 校验通过），保证「v2 必须向后兼容 v1 fixture」这类约束不靠自觉。

## 常见误区

- 「加字段也要升 schemaVersion」——兼容新增不需要；版本号只在破坏性变更时升级，否则版本号失去信号意义。
- 「消费者严格按 Schema 校验整条消息最安全」——严格校验会把所有兼容演进变成事故；校验应在生产侧/网关做，消费侧只做忽略未知字段的宽松解析 + 必填字段检查。
- 「没人用的字段可以直接删」——「没人用」需要证据（订阅清单 + 消费日志），消息的寿命比代码长。

## 官方资料

- JSON Schema Specification（draft-07，本仓库契约所用）：<https://json-schema.org/specification>（checkedAt: 2026-08-19）
- JSON Schema 官方文档入口：<https://json-schema.org/docs>（checkedAt: 2026-08-19）
