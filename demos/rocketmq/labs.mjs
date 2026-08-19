// RocketMQ 实验编排（规格 §7.3：delay、FIFO、事务回查、重试/DLQ 各有实验）。
// Topic/消费组一律经 mqadmin 显式创建（broker.conf 关闭了自动创建）。
// ctx API 由 scripts/lab.js 提供：up/waitForService/runJava/composeExec/assert/workDir。

import path from 'node:path'

const TOPIC = {
  basic: 'orders-basic',
  fifo: 'orders-fifo',
  delay: 'orders-delay',
  txn: 'orders-txn',
  retry: 'orders-retry',
}

const GROUP = {
  basic: 'orders-basic-group',
  fifo: 'orders-fifo-group',
  delay: 'orders-delay-group',
  txn: 'orders-txn-group',
  retry: 'orders-retry-group',
  dlqInspect: 'orders-dlq-inspect',
}

const FILES3 = 'order-1001.json,order-1002.json,order-1003.json'

function count(events, predicate) {
  return events.filter(predicate).length
}

function uniqueMessageIds(events) {
  return new Set(events.filter((e) => e.messageId).map((e) => e.messageId)).size
}

async function mqadmin(ctx, args) {
  // mqadmin 5.x 要求子命令在最前，-n 等选项必须放在子命令之后，否则会静默失败（exit 0）。
  const res = await ctx.composeExec('broker', ['sh', 'mqadmin', ...args, '-n', 'namesrv:9876'])
  if (/not exist/i.test(res.stdout) || /Exception|ERROR/i.test(`${res.stdout}\n${res.stderr}`)) {
    throw new Error(`mqadmin ${args[0]} failed: ${res.stdout}\n${res.stderr}`)
  }
  return res
}

async function waitRoute(ctx, topic) {
  // Broker 每 ~30s 向 NameServer 心跳注册路由；创建后必须等路由可见，否则客户端报 40402。
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    const res = await ctx.composeExec('broker', ['sh', 'mqadmin', 'topicRoute', '-t', topic, '-n', 'namesrv:9876'], { allowNonZero: true })
    if (res.exitCode === 0 && res.stdout.includes('brokerName')) return
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error(`topic route for ${topic} not visible in namesrv within 60s`)
}

async function createTopic(ctx, topic, type) {
  await mqadmin(ctx, ['updateTopic', '-c', 'DefaultCluster', '-t', topic, '-r', '4', '-w', '4', '-a', `+message.type=${type}`])
  await waitRoute(ctx, topic)
}

async function createGroup(ctx, group, extra = [], { dlq = false } = {}) {
  await mqadmin(ctx, ['updateSubGroup', '-c', 'DefaultCluster', '-g', group, ...extra])
  // broker.conf 关闭自动创建：%RETRY%（必要时 %DLQ%）路由须显式创建并等可见，否则重试/死信/consumerProgress 报 40402。
  await mqadmin(ctx, ['updateTopic', '-c', 'DefaultCluster', '-t', `%RETRY%${group}`, '-r', '1', '-w', '1'])
  await waitRoute(ctx, `%RETRY%${group}`)
  if (dlq) {
    await mqadmin(ctx, ['updateTopic', '-c', 'DefaultCluster', '-t', `%DLQ%${group}`, '-r', '1', '-w', '1'])
    await waitRoute(ctx, `%DLQ%${group}`)
  }
}

async function consumeDiff(ctx, group) {
  const res = await mqadmin(ctx, ['consumerProgress', '-g', group])
  const text = `${res.stdout}\n${res.stderr}`
  const m = text.match(/Consume Diff Total:\s*(-?\d+)/)
  return m ? Number(m[1]) : -999
}

export async function basic(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')
  await createTopic(ctx, TOPIC.basic, 'NORMAL')
  await createGroup(ctx, GROUP.basic)

  const consumerPromise = ctx.runJava(
    ['consume', `--topic=${TOPIC.basic}`, `--group=${GROUP.basic}`, `--db=${db}`, '--lab=basic', '--expected=3'],
    { label: 'consumer' },
  )
  const producer = await ctx.runJava(
    ['produce', '--lab=basic', `--topic=${TOPIC.basic}`, `--files=${FILES3}`],
    { label: 'producer' },
  )
  const consumer = await consumerPromise
  const inspect = await ctx.runJava(['inspect-db', '--lab=basic', `--db=${db}`], { label: 'inspect-db' })

  const businessRows = Number(inspect.events.find((e) => e.business_rows)?.business_rows ?? -1)
  ctx.assert('produced', count(producer.events, (e) => e.status === 'produced'), 3)
  ctx.assert('received', count(consumer.events, (e) => e.status === 'received'), 3)
  ctx.assert('uniqueMessageIds', uniqueMessageIds(consumer.events), 3)
  ctx.assert('businessCommitted', count(consumer.events, (e) => e.status === 'business_committed'), 3)
  ctx.assert('business_rows', businessRows, 3)
  ctx.assert('consumeDiff', await consumeDiff(ctx, GROUP.basic), 0)
  ctx.assert('consumerExitCode', consumer.exitCode, 0)
}

export async function fifoDelay(ctx) {
  const dbFifo = path.join(ctx.workDir, 'idempotency-fifo.db')
  const dbDelay = path.join(ctx.workDir, 'idempotency-delay.db')
  await createTopic(ctx, TOPIC.fifo, 'FIFO')
  await createTopic(ctx, TOPIC.delay, 'DELAY')
  await createGroup(ctx, GROUP.fifo)
  await createGroup(ctx, GROUP.delay)

  // FIFO：先生产后消费，顺序仍必须保持（FIFO Topic 的消费组按 MessageGroup 顺序派发）。
  const producer = await ctx.runJava(
    ['produce', '--lab=fifo-delay', `--topic=${TOPIC.fifo}`, `--files=${FILES3}`, '--group=order-1001'],
    { label: 'producer:fifo' },
  )
  const consumer = await ctx.runJava(
    ['consume', `--topic=${TOPIC.fifo}`, `--group=${GROUP.fifo}`, `--db=${dbFifo}`, '--lab=fifo-delay', '--expected=3'],
    { label: 'consumer:fifo' },
  )
  const received = consumer.events.filter((e) => e.status === 'received')
  ctx.assert('fifoProduced', count(producer.events, (e) => e.status === 'produced'), 3)
  ctx.assert('observedOrder', received.map((e) => Number(e.seq)), [1, 2, 3])
  ctx.assert('sameMessageGroup', received.filter((e) => e.messageGroup === 'order-1001').length, 3)

  // 定时消息：请求延迟 3s，实际投递延迟必须 ≥ 3s（Broker 定时调度不早于交付时间）。
  await ctx.runJava(
    ['produce', '--lab=fifo-delay', `--topic=${TOPIC.delay}`, '--files=order-1001.json', '--delay-ms=3000'],
    { label: 'producer:delay' },
  )
  const delayConsumer = await ctx.runJava(
    ['consume', `--topic=${TOPIC.delay}`, `--group=${GROUP.delay}`, `--db=${dbDelay}`, '--lab=fifo-delay', '--expected=1', '--hard-timeout-ms=30000'],
    { label: 'consumer:delay' },
  )
  const delayed = delayConsumer.events.filter((e) => e.status === 'received')
  ctx.assert('delayReceived', delayed.length, 1)
  ctx.assert('deliveryDelayMsAtLeast3000', delayed.every((e) => Number(e.deliveryDelayMs) >= 3000), true)
}

export { fifoDelay as 'fifo-delay' }

export async function transaction(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')
  await createTopic(ctx, TOPIC.txn, 'TRANSACTION')
  await createGroup(ctx, GROUP.txn)

  const consumerPromise = ctx.runJava(
    ['consume', `--topic=${TOPIC.txn}`, `--group=${GROUP.txn}`, `--db=${db}`, '--lab=transaction', '--expected=1', '--hard-timeout-ms=60000'],
    { label: 'consumer' },
  )
  const producer = await ctx.runJava(
    ['produce', '--lab=transaction', `--topic=${TOPIC.txn}`, '--files=order-1001.json', '--txn=commit-after-unknown'],
    { label: 'producer' },
  )
  const consumer = await consumerPromise
  const inspect = await ctx.runJava(['inspect-db', '--lab=transaction', `--db=${db}`], { label: 'inspect-db' })

  const resolved = producer.events.find((e) => e.status === 'txn_resolved')
  ctx.assert('halfSent', count(producer.events, (e) => e.status === 'half_sent'), 1)
  ctx.assert('checkBacksAtLeast2', Number(resolved?.checkBacks ?? 0) >= 2, true)
  ctx.assert('received', count(consumer.events, (e) => e.status === 'received'), 1)
  ctx.assert('businessCommitted', count(consumer.events, (e) => e.status === 'business_committed'), 1)
  ctx.assert('business_rows', Number(inspect.events.find((e) => e.business_rows)?.business_rows ?? -1), 1)
}

export async function retryDlq(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')
  const dbDlq = path.join(ctx.workDir, 'idempotency-dlq.db')
  await createTopic(ctx, TOPIC.retry, 'NORMAL')
  // 重试策略由消费组承载：最多重试 2 次、每次间隔 1s（CUSTOMIZED），耗尽后进 %DLQ%。
  const retryPolicy = JSON.stringify({
    type: 'CUSTOMIZED',
    customizedRetryPolicy: { next: [1000, 1000] },
  })
  await createGroup(ctx, GROUP.retry, ['-r', '2', '-p', retryPolicy], { dlq: true })
  await createGroup(ctx, GROUP.dlqInspect)

  const consumerPromise = ctx.runJava(
    [
      'consume', '--mode=push', `--topic=${TOPIC.retry}`, `--group=${GROUP.retry}`, `--db=${db}`,
      '--lab=retry-dlq', '--expected=1', '--fail-aggregate=order-poison', '--max-attempts=3',
    ],
    { label: 'consumer:push' },
  )
  const producer = await ctx.runJava(
    ['produce', '--lab=retry-dlq', `--topic=${TOPIC.retry}`, '--files=order-1001.json,poison-message.json'],
    { label: 'producer' },
  )
  const consumer = await consumerPromise
  const inspect = await ctx.runJava(['inspect-db', '--lab=retry-dlq', `--db=${db}`], { label: 'inspect-db' })

  const done = consumer.events.find((e) => e.status === 'done')
  ctx.assert('produced', count(producer.events, (e) => e.status === 'produced'), 2)
  ctx.assert('okReceived', count(consumer.events, (e) => e.status === 'received'), 1)
  ctx.assert('businessCommitted', count(consumer.events, (e) => e.status === 'business_committed'), 1)
  ctx.assert('business_rows', Number(inspect.events.find((e) => e.business_rows)?.business_rows ?? -1), 1)
  ctx.assert('poisonAttempts', consumer.events.filter((e) => e.status === 'consume_failed').length >= 2, true)
  ctx.assert('poisonMaxAttempt', Number(done?.poisonMaxAttempt ?? 0), 3)

  // DLQ 观察：毒消息耗尽重试后进入 %DLQ%<消费组> Topic，用独立消费组收出并核对。
  const dlq = await ctx.runJava(
    [
      'consume', `--topic=%DLQ%${GROUP.retry}`, `--group=${GROUP.dlqInspect}`, `--db=${dbDlq}`,
      '--lab=retry-dlq', '--expected=1', '--hard-timeout-ms=30000', '--consumer=dlq-inspect', '--no-business',
    ],
    { label: 'consumer:dlq' },
  )
  ctx.assert('dlqReceived', count(dlq.events, (e) => e.status === 'received'), 1)
  ctx.assert('dlqIsPoison', count(dlq.events, (e) => e.status === 'received' && e.aggregateId === 'order-poison'), 1)
}

export { retryDlq as 'retry-dlq' }
