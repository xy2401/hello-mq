// ActiveMQ Artemis 实验编排：anycast 队列可靠收发（L1）+ address-setting 重试与死信（L2）。
// ctx API 由 scripts/lab.js 提供：up/waitForService/runJava/composeExec/assert/workDir。
// 注意：所有消费断言都先起消费者再生产（队列虽持久化，但保持与其他分卷一致的观察顺序）。

import path from 'node:path'

const QUEUE = {
  basic: 'orders-basic',
  retry: 'orders-retry',
  dlq: 'orders-dlq',
}

const ORDER_FILES = 'order-1001.json,order-1002.json,order-1003.json'

function count(events, predicate) {
  return events.filter(predicate).length
}

function uniqueMessageIds(events) {
  return new Set(events.filter((e) => e.messageId).map((e) => e.messageId)).size
}

async function queueDepth(ctx, queue, lab) {
  const res = await ctx.runJava(['stats', `--lab=${lab}`, `--queue=${queue}`], { label: 'stats' })
  const snap = res.events.find((e) => e.queueDepth !== undefined) || {}
  return Number(snap.queueDepth ?? -999)
}

export async function basic(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')

  const consumerPromise = ctx.runJava(
    ['consume', `--queue=${QUEUE.basic}`, `--db=${db}`, '--lab=basic', '--expected=3'],
    { label: 'consumer' },
  )
  const producer = await ctx.runJava(
    ['produce', '--lab=basic', `--queue=${QUEUE.basic}`, `--files=${ORDER_FILES}`],
    { label: 'producer' },
  )
  const consumer = await consumerPromise
  const inspect = await ctx.runJava(['inspect-db', '--lab=basic', `--db=${db}`], { label: 'inspect-db' })

  const businessRows = Number(inspect.events.find((e) => e.business_rows)?.business_rows ?? -1)
  ctx.assert('confirmed', count(producer.events, (e) => e.status === 'confirmed'), 3)
  ctx.assert('received', count(consumer.events, (e) => e.status === 'received'), 3)
  ctx.assert('uniqueMessageIds', uniqueMessageIds(consumer.events), 3)
  ctx.assert('redeliveredCount', count(consumer.events, (e) => e.status === 'received' && e.redelivered === 'true'), 0)
  ctx.assert('businessCommitted', count(consumer.events, (e) => e.status === 'business_committed'), 3)
  ctx.assert('business_rows', businessRows, 3)
  // ack 即删除：全部确认后队列深度必须归零。
  ctx.assert('queueDepth', await queueDepth(ctx, QUEUE.basic, 'basic'), 0)
  ctx.assert('consumerExitCode', consumer.exitCode, 0)
}

export async function retryDlq(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')
  const dbDlq = path.join(ctx.workDir, 'idempotency-dlq.db')

  // 重试策略在 broker.xml 的 address-setting：共 3 次投递、固定 1s 间隔、耗尽转 orders-dlq。
  const consumerPromise = ctx.runJava(
    [
      'consume', `--queue=${QUEUE.retry}`, `--db=${db}`,
      '--lab=retry-dlq', '--expected=1', '--fail-aggregate=order-poison', '--max-attempts=3',
    ],
    { label: 'consumer' },
  )
  const producer = await ctx.runJava(
    ['produce', '--lab=retry-dlq', `--queue=${QUEUE.retry}`, '--files=order-1001.json,poison-message.json'],
    { label: 'producer' },
  )
  const consumer = await consumerPromise
  const inspect = await ctx.runJava(['inspect-db', '--lab=retry-dlq', `--db=${db}`], { label: 'inspect-db' })

  const done = consumer.events.find((e) => e.status === 'done')
  ctx.assert('confirmed', count(producer.events, (e) => e.status === 'confirmed'), 2)
  ctx.assert('okReceived', count(consumer.events, (e) => e.status === 'received' && e.aggregateId !== 'order-poison'), 1)
  ctx.assert('businessCommitted', count(consumer.events, (e) => e.status === 'business_committed'), 1)
  ctx.assert('business_rows', Number(inspect.events.find((e) => e.business_rows)?.business_rows ?? -1), 1)
  ctx.assert('poisonAttempts', consumer.events.filter((e) => e.status === 'consume_failed').length >= 2, true)
  ctx.assert('poisonMaxAttempt', Number(done?.poisonMaxAttempt ?? 0), 3)

  // DLQ 观察：毒消息耗尽投递次数后进入 orders-dlq，用 --no-business 消费者收出并核对。
  const dlq = await ctx.runJava(
    [
      'consume', `--queue=${QUEUE.dlq}`, `--db=${dbDlq}`,
      '--lab=retry-dlq', '--expected=1', '--hard-timeout-ms=30000', '--consumer=dlq-inspect', '--no-business',
    ],
    { label: 'consumer:dlq' },
  )
  ctx.assert('dlqReceived', count(dlq.events, (e) => e.status === 'received'), 1)
  ctx.assert('dlqIsPoison', count(dlq.events, (e) => e.status === 'received' && e.aggregateId === 'order-poison'), 1)
}

export { retryDlq as 'retry-dlq' }
