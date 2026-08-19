# Redis Streams 陷阱与检查表

> 本页结论：Redis Streams 的大多数事故来自把它当「更轻的 Kafka」或「更可靠的 Pub/Sub」——单 key 无分区、ACK 不删除、内存容量、异步复制丢失窗口，这四条边界必须在设计阶段写进方案。

## 默认值陷阱

| 默认行为 | 风险 | 建议 |
| :--- | :--- | :--- |
| 无裁剪（Stream 无限增长） | 内存耗尽触发驱逐/写入拒绝 | `XADD ... MAXLEN ~` 或定期 `XTRIM` |
| `XGROUP CREATE` 从 `$` 开始 | 组建之前的条目该组永远收不到 | 需要全量时用 `0`，并明确这是位点选择 |
| 无持久化配置（取决于部署） | 进程重启即丢全部条目 | 明确 AOF 策略，消息类数据至少 `everysec` |
| `maxmemory` 驱逐策略 | 默认策略可能把 Stream key 逐出 | 消息数据配 `noeviction`，宁可写失败也别静默丢 |
| XREADGROUP 大 COUNT | 单消费者拿走过多条目，崩溃后 PEL 巨量 | COUNT 与处理批长相匹配 |

## 错误类比（常见误区）

1. **「Redis Streams 是轻量版 Kafka」**——错在扩展模型：单 key 无分区、无副本协议、容量受单实例内存限制（见 [存储与高可用](/brokers/redis-streams/storage-ha)）。
2. **「Redis Pub/Sub 可以当队列用」**——Pub/Sub 无持久化、无消费组位点、订阅者离线即丢消息；只有 Streams 提供可靠消费。
3. **「XACK 之后消息就没了」**——ACK 只清 PEL；条目仍在并继续占内存，直到 XTRIM。
4. **「开了主从就不丢」**——复制是异步的，故障切换丢的是「最后一段未复制写入」，包括 PEL 状态。
5. **「PEL 里的条目一定会被重投」**——不会自动重投；没有 XCLAIM/XAUTOCLAIM 巡检，死亡消费者的 pending 会永远挂着。

## 不适用场景

- 多年保留、TB 级回放：内存成本不现实，用分区日志 + 分层存储。
- 单流超高吞吐 + 严格分区有序：单 key 瓶颈。
- 多租户平台、按租户配额与隔离：Redis 没有对应的租户模型。
- 需要服务端延迟/事务消息：均无原生支持。

## 生产检查表

- [ ] 每个 Stream 都有明确的保留策略（MAXLEN/MINID 数值与依据）。
- [ ] 持久化策略已选择并测试过重启恢复（AOF/RDB）。
- [ ] 有 XAUTOCLAIM/XCLAIM 巡检，min-idle 大于最长业务处理时长。
- [ ] 有死信 Stream 与投递次数上限，毒条目不会无限循环。
- [ ] 消费端幂等键已就位（重复必然发生，问题只是何时）。
- [ ] `maxmemory` + `noeviction` 已设置，写满时有告警与预案。
- [ ] ACL + TLS 已启用；6379 不对公网。
- [ ] 监控：lag、PEL count、idle 最大的 pending、used_memory、aof_last_write_status。
- [ ] 容量评估以「单 key 单节点」为前提，热点流已按业务键拆分。

## 一句话总结

Redis Streams 的价值是「已有 Redis 的地方，用数据结构的价格买到够用的可靠日志语义」；一旦需求越过单实例内存、分区并行或多租户边界，正确做法是换产品，而不是给 Streams 加补丁。
