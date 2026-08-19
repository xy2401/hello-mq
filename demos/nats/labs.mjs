// NATS 实验编排（规格 §7.6：Core NATS 与 JetStream 的可靠性目标不可混写）。
// ctx API 由 scripts/lab.js 提供：up/waitForService/runJava/composeExec/assert/workDir。

import path from 'node:path'

const SUBJECT_CORE = 'orders.core'
const SUBJECT_JS = 'orders.events'
const STREAM_ORDERS = 'ORDERS'

const ORDER_FILES = 'order-1001.json,order-1002.json,order-1003.json'

function count(events, predicate) {
  return events.filter(predicate).length
}

function uniqueMessageIds(events) {
  return new Set(events.filter((e) => e.messageId).map((e) => e.messageId)).size
}

export async function corePubsub(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')
  await ctx.runJava(['setup', '--lab=core-pubsub'])

  // 阶段 1：无订阅者时发布——Core NATS 不缓冲、不持久化，消息即发即弃
  const lost = await ctx.runJava(
    ['produce', '--lab=core-pubsub', '--mode=core', `--subject=${SUBJECT_CORE}`, `--files=${ORDER_FILES}`, '--phase=lost'],
    { label: 'producer:lost' },
  )
  ctx.assert('lostPublished', count(lost.events, (e) => e.status === 'published'), 3)

  // 阶段 2：先订阅再发布，3 发 3 收
  const consumerPromise = ctx.runJava(
    ['consume', '--lab=core-pubsub', '--mode=core', `--subject=${SUBJECT_CORE}`, '--consumer=consumer-1', `--db=${db}`, '--expected=3'],
    { label: 'consumer' },
  )
  // Core NATS 无队列缓冲：必须等订阅抵达服务端后再发布，否则消息同样会丢。
  // 这正是易失语义的一部分——生产端无法从协议上确认是否存在订阅者。
  await new Promise((resolve) => setTimeout(resolve, 2000))
  const live = await ctx.runJava(
    ['produce', '--lab=core-pubsub', '--mode=core', `--subject=${SUBJECT_CORE}`, `--files=${ORDER_FILES}`, '--phase=live'],
    { label: 'producer:live' },
  )
  const consumer = await consumerPromise
  const inspect = await ctx.runJava(['inspect-db', '--lab=core-pubsub', `--db=${db}`], { label: 'inspect-db' })

  const businessRows = Number(inspect.events.find((e) => e.business_rows)?.business_rows ?? -1)
  ctx.assert('livePublished', count(live.events, (e) => e.status === 'published'), 3)
  ctx.assert('received', count(consumer.events, (e) => e.status === 'received'), 3)
  ctx.assert('uniqueMessageIds', uniqueMessageIds(consumer.events), 3)
  ctx.assert('businessCommitted', count(consumer.events, (e) => e.status === 'business_committed'), 3)
  ctx.assert('business_rows', businessRows, 3)
  ctx.assert('consumerExitCode', consumer.exitCode, 0)
}

// 与 labs.json 中的 name 保持一致（含连字符的导出名不合法，lab.js 按 name 映射）。
export { corePubsub as 'core-pubsub' }

export async function jetstreamReplay(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')
  await ctx.runJava(['setup', '--lab=jetstream-replay'])

  const producer = await ctx.runJava(
    ['produce', '--lab=jetstream-replay', '--mode=jetstream', `--subject=${SUBJECT_JS}`, `--files=${ORDER_FILES}`],
    { label: 'producer' },
  )

  const run1 = await ctx.runJava(
    ['consume', '--lab=jetstream-replay', '--mode=jetstream', `--subject=${SUBJECT_JS}`, '--durable=orders-first', `--db=${db}`, '--expected=3'],
    { label: 'consumer:first' },
  )

  // 第二个 durable consumer 从头消费同一批消息：回放能力是 JetStream 的核心语义
  const run2 = await ctx.runJava(
    ['consume', '--lab=jetstream-replay', '--mode=jetstream', `--subject=${SUBJECT_JS}`, '--durable=orders-replay', `--db=${db}`, '--expected=3'],
    { label: 'consumer:replay' },
  )
  const inspect = await ctx.runJava(['inspect-db', '--lab=jetstream-replay', `--db=${db}`], { label: 'inspect-db' })
  const stats = await ctx.runJava(['stats', '--lab=jetstream-replay', `--stream=${STREAM_ORDERS}`], { label: 'stats' })

  const allEvents = [...run1.events, ...run2.events]
  const businessRows = Number(inspect.events.find((e) => e.business_rows)?.business_rows ?? -1)
  const streamMessages = Number(stats.events.find((e) => e.streamMessages)?.streamMessages ?? -1)
  ctx.assert('confirmed', count(producer.events, (e) => e.status === 'confirmed'), 3)
  ctx.assert('receivedTotal', count(allEvents, (e) => e.status === 'received'), 6)
  ctx.assert('uniqueMessageIds', uniqueMessageIds(allEvents), 3)
  ctx.assert('businessCommitted', count(run1.events, (e) => e.status === 'business_committed'), 3)
  ctx.assert('duplicatesSkipped', count(run2.events, (e) => e.status === 'duplicate_skipped'), 3)
  ctx.assert('duplicatesApplied', businessRows === 3 ? 0 : businessRows - 3, 0)
  ctx.assert('business_rows', businessRows, 3)
  // ACK 不删除消息：保留策略（Limits/Interest/WorkQueue）才决定删除时机
  ctx.assert('streamMessagesAfter', streamMessages, 3)
  ctx.assert('consumerExitCode', run2.exitCode, 0)
}

export { jetstreamReplay as 'jetstream-replay' }
