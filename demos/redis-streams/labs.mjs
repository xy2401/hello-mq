// Redis Streams 实验编排（规格 §9.4-6：先启动 Consumer，再运行 Producer）。
// ctx API 由 scripts/lab.js 提供：up/waitForService/runJava/composeExec/assert/workDir。

import path from 'node:path'

const STREAM = {
  basic: 'orders.basic',
  basicGroup: 'orders-basic-group',
  crash: 'orders.crash',
  crashGroup: 'orders-crash-group',
}

const ORDER_FILES = 'order-1001.json,order-1002.json,order-1003.json'

function count(events, predicate) {
  return events.filter(predicate).length
}

function uniqueMessageIds(events) {
  return new Set(events.filter((e) => e.messageId).map((e) => e.messageId)).size
}

async function stats(ctx, stream, group, lab) {
  const res = await ctx.runJava(['stats', `--lab=${lab}`, `--stream=${stream}`, `--group=${group}`], { label: 'stats' })
  const snap = res.events.find((e) => e.status === 'snapshot') || {}
  return { streamLength: Number(snap.streamLength ?? -1), pending: Number(snap.pending ?? -1) }
}

export async function basic(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')
  await ctx.runJava(['setup', '--lab=basic'])

  const consumerPromise = ctx.runJava(
    ['consume', `--stream=${STREAM.basic}`, `--group=${STREAM.basicGroup}`, '--consumer=consumer-1', `--db=${db}`, '--lab=basic', '--expected=3'],
    { label: 'consumer' },
  )
  const producer = await ctx.runJava(
    ['produce', '--lab=basic', `--stream=${STREAM.basic}`, `--files=${ORDER_FILES}`],
    { label: 'producer' },
  )
  const consumer = await consumerPromise
  const inspect = await ctx.runJava(['inspect-db', '--lab=basic', `--db=${db}`], { label: 'inspect-db' })
  const after = await stats(ctx, STREAM.basic, STREAM.basicGroup, 'basic')

  const businessRows = Number(inspect.events.find((e) => e.business_rows)?.business_rows ?? -1)
  ctx.assert('confirmed', count(producer.events, (e) => e.status === 'confirmed'), 3)
  ctx.assert('received', count(consumer.events, (e) => e.status === 'received'), 3)
  ctx.assert('uniqueMessageIds', uniqueMessageIds(consumer.events), 3)
  ctx.assert('redeliveredCount', count(consumer.events, (e) => e.status === 'received' && e.redelivered === 'true'), 0)
  ctx.assert('businessCommitted', count(consumer.events, (e) => e.status === 'business_committed'), 3)
  ctx.assert('duplicatesSkipped', count(consumer.events, (e) => e.status === 'duplicate_skipped'), 0)
  ctx.assert('business_rows', businessRows, 3)
  // 关键语义差异：XACK 不从 Stream 删除条目，消费位置记录在 Consumer Group 侧
  ctx.assert('streamLengthAfter', after.streamLength, 3)
  ctx.assert('pendingAfter', after.pending, 0)
  ctx.assert('consumerExitCode', consumer.exitCode, 0)
}

export async function consumerCrash(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')
  await ctx.runJava(['setup', '--lab=consumer-crash'])

  await ctx.runJava(['produce', '--lab=consumer-crash', `--stream=${STREAM.crash}`, `--files=${ORDER_FILES}`], { label: 'producer' })

  // run1：消费第 1 条并业务提交后、XACK 前崩溃，条目滞留 PEL
  const run1 = await ctx.runJava(
    ['consume', `--stream=${STREAM.crash}`, `--group=${STREAM.crashGroup}`, '--consumer=consumer-1', `--db=${db}`, '--lab=consumer-crash', '--expected=3', '--crash-before-ack-at=1'],
    { allowNonZero: true, label: 'consumer:run1' },
  )
  ctx.assert('crashExitCode', run1.exitCode, 137)
  ctx.assert('crashAfterBusinessCommit', count(run1.events, (e) => e.status === 'business_committed'), 1)
  const mid = await stats(ctx, STREAM.crash, STREAM.crashGroup, 'consumer-crash')
  ctx.assert('pendingAfterCrash', mid.pending, 1)

  // run2：新消费者先 XCLAIM 接管 PEL 中的未确认条目，再继续消费新条目
  const run2 = await ctx.runJava(
    ['consume', `--stream=${STREAM.crash}`, `--group=${STREAM.crashGroup}`, '--consumer=consumer-2', `--db=${db}`, '--lab=consumer-crash', '--expected=3', '--claim'],
    { label: 'consumer:run2' },
  )
  const inspect = await ctx.runJava(['inspect-db', '--lab=consumer-crash', `--db=${db}`], { label: 'inspect-db' })
  const after = await stats(ctx, STREAM.crash, STREAM.crashGroup, 'consumer-crash')

  const allEvents = [...run1.events, ...run2.events]
  const businessRows = Number(inspect.events.find((e) => e.business_rows)?.business_rows ?? -1)
  ctx.assert('receivedTotal', count(allEvents, (e) => e.status === 'received'), 4)
  ctx.assert('redeliveredCount', count(run2.events, (e) => e.status === 'received' && e.redelivered === 'true'), 1)
  ctx.assert('duplicatesObserved', count(run2.events, (e) => e.status === 'duplicate_skipped'), 1)
  ctx.assert('duplicatesApplied', businessRows === 3 ? 0 : businessRows - 3, 0)
  ctx.assert('uniqueMessageIds', uniqueMessageIds(allEvents), 3)
  ctx.assert('business_rows', businessRows, 3)
  ctx.assert('streamLengthAfter', after.streamLength, 3)
  ctx.assert('pendingAfter', after.pending, 0)
  ctx.assert('consumerExitCode', run2.exitCode, 0)
}

// 与 labs.json 中的 name 保持一致（含连字符的导出名不合法，lab.js 按 name 映射）。
export { consumerCrash as 'consumer-crash' }
