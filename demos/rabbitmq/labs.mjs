// RabbitMQ 实验编排（规格 §9.4-6：先启动 Consumer，再运行 Producer）。
// ctx API 由 scripts/lab.js 提供：up/waitForService/runJava/composeExec/assert/workDir。

import path from 'node:path'

const QUEUE = {
  basic: 'orders.basic',
  crash: 'orders.crash',
  work: 'orders.work',
  retry: 'orders.retry',
  dlq: 'orders.dlq',
  backlog: 'orders.backlog',
  routingExchange: 'orders.events',
  routingCreated: 'orders.routing.created',
  routingAll: 'orders.routing.all',
  routingEu: 'orders.routing.eu',
}

const ORDER_FILES = 'order-1001.json,order-1002.json,order-1003.json'

async function rabbitmqCtlJson(ctx, args) {
  const res = await ctx.composeExec(ctx.service, ['rabbitmqctl', ...args, '--formatter=json'])
  return JSON.parse(res.stdout)
}

async function queueDepth(ctx, queue) {
  const data = await rabbitmqCtlJson(ctx, ['list_queues', 'name', 'messages'])
  const row = data.find((r) => r.name === queue)
  return row ? row.messages : 0
}

function count(events, predicate) {
  return events.filter(predicate).length
}

function uniqueMessageIds(events) {
  return new Set(events.filter((e) => e.messageId).map((e) => e.messageId)).size
}

export async function basic(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')
  await ctx.runJava(['setup', '--lab=basic'])

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
  ctx.assert('duplicatesSkipped', count(consumer.events, (e) => e.status === 'duplicate_skipped'), 0)
  ctx.assert('business_rows', businessRows, 3)
  ctx.assert('queueDepthAfter', await queueDepth(ctx, QUEUE.basic), 0)
  ctx.assert('consumerExitCode', consumer.exitCode, 0)
}

export async function routing(ctx) {
  await ctx.runJava(['setup', '--lab=routing'])

  const producer = await ctx.runJava(
    [
      'produce',
      '--lab=routing',
      `--exchange=${QUEUE.routingExchange}`,
      '--files=order-1001.json,order-1002.json,order-1003.json',
      '--routing-keys=order.created,order.created,order.created.eu',
    ],
    { label: 'producer' },
  )
  ctx.assert('confirmed', count(producer.events, (e) => e.status === 'confirmed'), 3)

  const expectations = [
    { queue: QUEUE.routingCreated, expected: 2 },
    { queue: QUEUE.routingAll, expected: 3 },
    { queue: QUEUE.routingEu, expected: 1 },
  ]
  for (const { queue, expected } of expectations) {
    const db = path.join(ctx.workDir, `idempotency-${queue}.db`)
    const consumer = await ctx.runJava(
      ['consume', `--queue=${queue}`, `--db=${db}`, '--lab=routing', `--expected=${expected}`],
      { label: `consumer:${queue}` },
    )
    ctx.assert(`received:${queue}`, count(consumer.events, (e) => e.status === 'received'), expected)
    ctx.assert(`unique:${queue}`, uniqueMessageIds(consumer.events), expected)
    ctx.assert(`depthAfter:${queue}`, await queueDepth(ctx, queue), 0)
  }
}

export async function consumerCrash(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')
  await ctx.runJava(['setup', '--lab=consumer-crash'])

  await ctx.runJava(['produce', '--lab=consumer-crash', `--queue=${QUEUE.crash}`, `--files=${ORDER_FILES}`], { label: 'producer' })

  const run1 = await ctx.runJava(
    ['consume', `--queue=${QUEUE.crash}`, `--db=${db}`, '--lab=consumer-crash', '--expected=3', '--crash-before-ack-at=1'],
    { allowNonZero: true, label: 'consumer:run1' },
  )
  ctx.assert('crashExitCode', run1.exitCode, 137)
  ctx.assert('crashAfterBusinessCommit', count(run1.events, (e) => e.status === 'business_committed'), 1)

  const run2 = await ctx.runJava(
    ['consume', `--queue=${QUEUE.crash}`, `--db=${db}`, '--lab=consumer-crash', '--expected=3'],
    { label: 'consumer:run2' },
  )
  const inspect = await ctx.runJava(['inspect-db', '--lab=consumer-crash', `--db=${db}`], { label: 'inspect-db' })

  const allEvents = [...run1.events, ...run2.events]
  const businessRows = Number(inspect.events.find((e) => e.business_rows)?.business_rows ?? -1)
  ctx.assert('receivedTotal', count(allEvents, (e) => e.status === 'received'), 4)
  ctx.assert('redeliveredCount', count(run2.events, (e) => e.status === 'received' && e.redelivered === 'true'), 1)
  ctx.assert('duplicatesObserved', count(run2.events, (e) => e.status === 'duplicate_skipped'), 1)
  ctx.assert('duplicatesApplied', businessRows === 3 ? 0 : businessRows - 3, 0)
  ctx.assert('uniqueMessageIds', uniqueMessageIds(allEvents), 3)
  ctx.assert('business_rows', businessRows, 3)
  ctx.assert('queueDepthAfter', await queueDepth(ctx, QUEUE.crash), 0)
  ctx.assert('consumerExitCode', run2.exitCode, 0)
}

// 与 labs.json 中的 name 保持一致（含连字符的导出名不合法，lab.js 按 name 映射）。
export { consumerCrash as 'consumer-crash' }

export async function retryDlq(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')
  await ctx.runJava(['setup', '--lab=retry-dlq'])

  const producer = await ctx.runJava(
    ['produce', '--lab=retry-dlq', `--queue=${QUEUE.work}`, '--files=order-1001.json,order-1002.json,poison-message.json'],
    { label: 'producer' },
  )

  const consumer = await ctx.runJava(
    [
      'consume',
      `--queue=${QUEUE.work}`,
      `--db=${db}`,
      '--lab=retry-dlq',
      '--retry-mode',
      '--max-attempts=3',
      `--dlq=${QUEUE.dlq}`,
      '--expected-ok=2',
    ],
    { label: 'consumer' },
  )
  const inspect = await ctx.runJava(['inspect-db', '--lab=retry-dlq', `--db=${db}`], { label: 'inspect-db' })

  const poisonAttempts = consumer.events
    .filter((e) => e.status === 'received' && e.correlationId === 'order-poison')
    .map((e) => Number(e.attempt))
  const businessRows = Number(inspect.events.find((e) => e.business_rows)?.business_rows ?? -1)

  ctx.assert('confirmed', count(producer.events, (e) => e.status === 'confirmed'), 3)
  ctx.assert('business_rows', businessRows, 2)
  ctx.assert('poisonAttempts', poisonAttempts, [1, 2, 3])
  ctx.assert('poisonMovedToDlq', count(consumer.events, (e) => e.status === 'poison_to_dlq'), 1)
  ctx.assert('dlqMessages', await queueDepth(ctx, QUEUE.dlq), 1)
  ctx.assert('workQueueDepthAfter', await queueDepth(ctx, QUEUE.work), 0)
  ctx.assert('retryQueueDepthAfter', await queueDepth(ctx, QUEUE.retry), 0)
  ctx.assert('consumerExitCode', consumer.exitCode, 0)
}

export { retryDlq as 'retry-dlq' }

export async function backlogRecovery(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')
  await ctx.runJava(['setup', '--lab=backlog-recovery'])
  // 清掉历史残留，保证积压计数只反映本轮生产
  await ctx.composeExec(ctx.service, ['rabbitmqctl', 'purge_queue', QUEUE.backlog])

  // 阶段 1：无消费者，6 条消息（3 fixture × repeat=2，每条 messageId 不同）积压在 durable 队列。
  const producer = await ctx.runJava(
    ['produce', '--lab=backlog-recovery', `--queue=${QUEUE.backlog}`, `--files=${ORDER_FILES}`, '--repeat=2'],
    { label: 'producer' },
  )
  ctx.assert('confirmed', count(producer.events, (e) => e.status === 'confirmed'), 6)
  ctx.assert('backlogDepth', await queueDepth(ctx, QUEUE.backlog), 6)

  // 阶段 2：消费者启动后追赶积压，全部处理完毕，队列清零。
  const consumer = await ctx.runJava(
    ['consume', `--queue=${QUEUE.backlog}`, `--db=${db}`, '--lab=backlog-recovery', '--expected=6'],
    { label: 'consumer' },
  )
  const inspect = await ctx.runJava(['inspect-db', '--lab=backlog-recovery', `--db=${db}`], { label: 'inspect-db' })

  ctx.assert('received', count(consumer.events, (e) => e.status === 'received'), 6)
  ctx.assert('uniqueMessageIds', uniqueMessageIds(consumer.events), 6)
  // 第二轮消息与第一轮同 orderId：messageId 不同但业务键重复，幂等收敛为 3 条业务写入
  ctx.assert('businessCommitted', count(consumer.events, (e) => e.status === 'business_committed'), 3)
  ctx.assert('businessDuplicatesSkipped', count(consumer.events, (e) => e.status === 'duplicate_skipped'), 3)
  ctx.assert('business_rows', Number(inspect.events.find((e) => e.business_rows)?.business_rows ?? -1), 3)
  ctx.assert('queueDepthAfter', await queueDepth(ctx, QUEUE.backlog), 0)
  ctx.assert('consumerExitCode', consumer.exitCode, 0)
}

export { backlogRecovery as 'backlog-recovery' }
