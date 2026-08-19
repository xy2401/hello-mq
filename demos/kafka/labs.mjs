// Kafka 实验编排（规格 §9.4-6：先启动 Consumer，再运行 Producer；consumer-group 例外见注释）。
// ctx API 由 scripts/lab.js 提供：up/waitForService/runJava/composeExec/assert/workDir。

import path from 'node:path'

const TOPIC = {
  basic: 'orders.basic',
  group: 'orders.group',
  ordering: 'orders.ordering',
  txn: 'orders.txn',
}

const GROUP = {
  basic: 'orders-basic-group',
  a: 'orders-group-a',
  b: 'orders-group-b',
  ordering1: 'orders-ordering-g1',
  ordering2: 'orders-ordering-g2',
  txn: 'orders-txn-group',
}

const ORDER_FILES = 'order-1001.json,order-1002.json,order-1003.json'

function count(events, predicate) {
  return events.filter(predicate).length
}

function uniqueMessageIds(events) {
  return new Set(events.filter((e) => e.messageId).map((e) => e.messageId)).size
}

async function groupLag(ctx, group) {
  const res = await ctx.composeExec('kafka', [
    '/opt/kafka/bin/kafka-consumer-groups.sh',
    '--bootstrap-server',
    'localhost:9092',
    '--describe',
    '--group',
    group,
  ])
  let lag = 0
  for (const line of res.stdout.split('\n')) {
    const cols = line.trim().split(/\s+/)
    if (cols.length < 6 || cols[0] === 'GROUP' || cols[5] === '-') continue
    lag += Number(cols[5]) || 0
  }
  return lag
}

export async function basic(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')
  await ctx.runJava(['setup', '--lab=basic'])

  const consumerPromise = ctx.runJava(
    ['consume', `--topic=${TOPIC.basic}`, `--group=${GROUP.basic}`, `--db=${db}`, '--lab=basic', '--expected=3'],
    { label: 'consumer' },
  )
  const producer = await ctx.runJava(
    ['produce', '--lab=basic', `--topic=${TOPIC.basic}`, `--files=${ORDER_FILES}`],
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
  ctx.assert('consumerGroupLag', await groupLag(ctx, GROUP.basic), 0)
  ctx.assert('consumerExitCode', consumer.exitCode, 0)
}

export async function consumerGroup(ctx) {
  await ctx.runJava(['setup', '--lab=consumer-group'])
  const producer = await ctx.runJava(
    ['produce', '--lab=consumer-group', `--topic=${TOPIC.group}`, `--files=${ORDER_FILES}`],
    { label: 'producer' },
  )
  ctx.assert('produced', count(producer.events, (e) => e.status === 'produced'), 3)

  // 同组两个消费者：分配不确定，用空闲超时退出，再合并统计。
  const dbA1 = path.join(ctx.workDir, 'idempotency-a1.db')
  const dbA2 = path.join(ctx.workDir, 'idempotency-a2.db')
  const [a1, a2] = await Promise.all([
    ctx.runJava(
      ['consume', `--topic=${TOPIC.group}`, `--group=${GROUP.a}`, `--db=${dbA1}`, '--lab=consumer-group', '--consumer=a-1', '--idle-exit-ms=8000'],
      { label: 'consumer:a-1' },
    ),
    ctx.runJava(
      ['consume', `--topic=${TOPIC.group}`, `--group=${GROUP.a}`, `--db=${dbA2}`, '--lab=consumer-group', '--consumer=a-2', '--idle-exit-ms=8000'],
      { label: 'consumer:a-2' },
    ),
  ])
  const groupAEvents = [...a1.events, ...a2.events]
  ctx.assert('groupAReceived', count(groupAEvents, (e) => e.status === 'received'), 3)
  ctx.assert('groupAUnique', uniqueMessageIds(groupAEvents), 3)
  ctx.assert('a1Assigned', count(a1.events, (e) => e.status === 'assigned' && e.partitions?.length > 0) > 0, true)
  ctx.assert('a2Assigned', count(a2.events, (e) => e.status === 'assigned' && e.partitions?.length > 0) > 0, true)
  ctx.assert('a1ExitCode', a1.exitCode, 0)
  ctx.assert('a2ExitCode', a2.exitCode, 0)

  // 独立组 b：同一条消息再次全量接收（组间互不影响）。
  const dbB = path.join(ctx.workDir, 'idempotency-b.db')
  const b = await ctx.runJava(
    ['consume', `--topic=${TOPIC.group}`, `--group=${GROUP.b}`, `--db=${dbB}`, '--lab=consumer-group', '--consumer=b-1', '--expected=3'],
    { label: 'consumer:b-1' },
  )
  const inspectB = await ctx.runJava(['inspect-db', '--lab=consumer-group', `--db=${dbB}`], { label: 'inspect-db:b' })
  ctx.assert('groupBReceived', count(b.events, (e) => e.status === 'received'), 3)
  ctx.assert('groupBBusinessRows', Number(inspectB.events.find((e) => e.business_rows)?.business_rows ?? -1), 3)
  ctx.assert('groupALag', await groupLag(ctx, GROUP.a), 0)
}

export { consumerGroup as 'consumer-group' }

export async function orderingReplay(ctx) {
  await ctx.runJava(['setup', '--lab=ordering-replay'])
  const producer = await ctx.runJava(
    ['produce', '--lab=ordering-replay', `--topic=${TOPIC.ordering}`, '--files=order-1001.json', '--repeat=6', '--key=order-1001'],
    { label: 'producer' },
  )
  ctx.assert('produced', count(producer.events, (e) => e.status === 'produced'), 6)
  ctx.assert('samePartitionOnProduce', new Set(producer.events.filter((e) => e.status === 'produced').map((e) => e.partitionOrQueue)).size, 1)

  const db1 = path.join(ctx.workDir, 'idempotency-g1.db')
  const g1 = await ctx.runJava(
    ['consume', `--topic=${TOPIC.ordering}`, `--group=${GROUP.ordering1}`, `--db=${db1}`, '--lab=ordering-replay', '--consumer=g1', '--expected=6'],
    { label: 'consumer:g1' },
  )
  const received = g1.events.filter((e) => e.status === 'received')
  const partitions = new Set(received.map((e) => e.partitionOrQueue))
  const observedSeq = received.map((e) => Number(e.seq))
  ctx.assert('samePartitionOnConsume', partitions.size, 1)
  ctx.assert('observedOrder', observedSeq, [1, 2, 3, 4, 5, 6])

  // 新消费组从 earliest 回放全部（offset 从 0 开始）。
  const db2 = path.join(ctx.workDir, 'idempotency-g2.db')
  const g2 = await ctx.runJava(
    ['consume', `--topic=${TOPIC.ordering}`, `--group=${GROUP.ordering2}`, `--db=${db2}`, '--lab=ordering-replay', '--consumer=g2', '--expected=6', '--auto-offset-reset=earliest'],
    { label: 'consumer:g2' },
  )
  const replayed = g2.events.filter((e) => e.status === 'received')
  ctx.assert('replayed', replayed.length, 6)
  ctx.assert('replayFromOffset0', Math.min(...replayed.map((e) => Number(e.offset))), 0)
  ctx.assert('replayUniqueMessageIds', uniqueMessageIds(g2.events), 6)
}

export { orderingReplay as 'ordering-replay' }

export async function idempotenceTransaction(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')
  await ctx.runJava(['setup', '--lab=idempotence-transaction'])

  const consumerPromise = ctx.runJava(
    ['consume', `--topic=${TOPIC.txn}`, `--group=${GROUP.txn}`, `--db=${db}`, '--lab=idempotence-transaction', '--expected=3', '--isolation=read_committed'],
    { label: 'consumer' },
  )
  const committed = await ctx.runJava(
    ['produce', '--lab=idempotence-transaction', `--topic=${TOPIC.txn}`, `--files=${ORDER_FILES}`, '--txn=commit'],
    { label: 'producer:commit' },
  )
  const aborted = await ctx.runJava(
    ['produce', '--lab=idempotence-transaction', `--topic=${TOPIC.txn}`, '--files=order-1001.json,order-1002.json', '--txn=abort'],
    { label: 'producer:abort' },
  )
  const consumer = await consumerPromise
  const inspect = await ctx.runJava(['inspect-db', '--lab=idempotence-transaction', `--db=${db}`], { label: 'inspect-db' })

  ctx.assert('txnCommitted', count(committed.events, (e) => e.status === 'txn_committed'), 1)
  ctx.assert('txnAborted', count(aborted.events, (e) => e.status === 'txn_aborted'), 1)
  const receivedTotal = count(consumer.events, (e) => e.status === 'received')
  ctx.assert('committedVisible', receivedTotal, 3)
  ctx.assert('abortedVisible', receivedTotal - 3, 0)
  ctx.assert('business_rows', Number(inspect.events.find((e) => e.business_rows)?.business_rows ?? -1), 3)
  ctx.assert('consumerGroupLag', await groupLag(ctx, GROUP.txn), 0)
  ctx.assert('consumerExitCode', consumer.exitCode, 0)
}

export { idempotenceTransaction as 'idempotence-transaction' }
