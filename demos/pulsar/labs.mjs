// Pulsar 实验编排（规格 §7.4：四订阅类型对比 + 重投/DLQ + 位置重置回放）。
// ctx API 由 scripts/lab.js 提供：up/waitForService/runJava/composeExec/assert/workDir。
// 注意：Pulsar 新订阅默认从 Latest 开始，所以所有消费断言都先起消费者再生产。

import path from 'node:path'

const TOPIC = {
  basic: 'orders-basic',
  subs: 'orders-subscriptions',
  redelivery: 'orders-redelivery',
}

const SUB = {
  basic: 'orders-basic-sub',
  exclusive: 'orders-exclusive-sub',
  shared: 'orders-shared-sub',
  failover: 'orders-failover-sub',
  keyShared: 'orders-keyshared-sub',
  redeliver: 'orders-redeliver-sub',
  dlqInspect: 'orders-dlq-inspect-sub',
}

const FULL = (topic) => `persistent://public/default/${topic}`

const ORDER_FILES = 'order-1001.json,order-1002.json,order-1003.json'

function count(events, predicate) {
  return events.filter(predicate).length
}

function uniqueMessageIds(events) {
  return new Set(events.filter((e) => e.messageId).map((e) => e.messageId)).size
}

async function topicBacklog(ctx, topic) {
  const res = await ctx.composeExec('pulsar', ['bin/pulsar-admin', 'topics', 'stats', FULL(topic)])
  let backlog = 0
  let matched = false
  for (const m of res.stdout.matchAll(/Msg backlog in number of messages\s*:\s*(\d+)/gi)) {
    backlog += Number(m[1])
    matched = true
  }
  return matched ? backlog : -999
}

export async function basic(ctx) {
  const db = path.join(ctx.workDir, 'idempotency.db')
  await ctx.runJava(['setup', '--lab=basic'])

  const consumerPromise = ctx.runJava(
    ['consume', `--topic=${TOPIC.basic}`, `--subscription=${SUB.basic}`, '--sub-type=Exclusive', `--db=${db}`, '--lab=basic', '--expected=3'],
    { label: 'consumer' },
  )
  const producer = await ctx.runJava(
    ['produce', '--lab=basic', `--topic=${TOPIC.basic}`, `--files=${ORDER_FILES}`],
    { label: 'producer' },
  )
  const consumer = await consumerPromise
  const inspect = await ctx.runJava(['inspect-db', '--lab=basic', `--db=${db}`], { label: 'inspect-db' })

  ctx.assert('produced', count(producer.events, (e) => e.status === 'produced'), 3)
  ctx.assert('received', count(consumer.events, (e) => e.status === 'received'), 3)
  ctx.assert('uniqueMessageIds', uniqueMessageIds(consumer.events), 3)
  ctx.assert('businessCommitted', count(consumer.events, (e) => e.status === 'business_committed'), 3)
  ctx.assert('business_rows', Number(inspect.events.find((e) => e.business_rows)?.business_rows ?? -1), 3)
  ctx.assert('topicBacklog', await topicBacklog(ctx, TOPIC.basic), 0)
  ctx.assert('consumerExitCode', consumer.exitCode, 0)
}

export async function subscriptions(ctx) {
  await ctx.runJava(['setup', '--lab=subscriptions'])

  // Exclusive：独占订阅，第二个同订阅消费者必须被拒绝（ConsumerBusy）。
  const dbEx = path.join(ctx.workDir, 'idempotency-exclusive.db')
  const exConsumerPromise = ctx.runJava(
    ['consume', `--topic=${TOPIC.subs}`, `--subscription=${SUB.exclusive}`, '--sub-type=Exclusive', `--db=${dbEx}`, '--lab=subscriptions', '--consumer=ex-1', '--expected=3'],
    { label: 'consumer:exclusive' },
  )
  const exProducer = await ctx.runJava(
    ['produce', '--lab=subscriptions', `--topic=${TOPIC.subs}`, `--files=${ORDER_FILES}`],
    { label: 'producer:exclusive' },
  )
  const exConsumer = await exConsumerPromise
  ctx.assert('produced', count(exProducer.events, (e) => e.status === 'produced'), 3)
  ctx.assert('exclusiveReceived', count(exConsumer.events, (e) => e.status === 'received'), 3)
  const collision = await ctx.runJava(
    ['consume', `--topic=${TOPIC.subs}`, `--subscription=${SUB.exclusive}`, '--sub-type=Exclusive', `--db=${path.join(ctx.workDir, 'idempotency-collision.db')}`, '--lab=subscriptions', '--consumer=ex-2', '--idle-exit-ms=3000'],
    { label: 'consumer:exclusive-collision', allowNonZero: true },
  )
  ctx.assert('exclusiveSecondConsumerRejected', collision.exitCode !== 0, true)

  // Shared：两个消费者瓜分消息，每条恰被消费一次。
  const dbS1 = path.join(ctx.workDir, 'idempotency-shared-1.db')
  const dbS2 = path.join(ctx.workDir, 'idempotency-shared-2.db')
  const [s1Promise, s2Promise] = [
    ctx.runJava(
      ['consume', `--topic=${TOPIC.subs}`, `--subscription=${SUB.shared}`, '--sub-type=Shared', `--db=${dbS1}`, '--lab=subscriptions', '--consumer=s-1', '--idle-exit-ms=8000'],
      { label: 'consumer:shared-1' },
    ),
    ctx.runJava(
      ['consume', `--topic=${TOPIC.subs}`, `--subscription=${SUB.shared}`, '--sub-type=Shared', `--db=${dbS2}`, '--lab=subscriptions', '--consumer=s-2', '--idle-exit-ms=8000'],
      { label: 'consumer:shared-2' },
    ),
  ]
  await ctx.runJava(
    ['produce', '--lab=subscriptions', `--topic=${TOPIC.subs}`, `--files=${ORDER_FILES}`],
    { label: 'producer:shared' },
  )
  const [s1, s2] = await Promise.all([s1Promise, s2Promise])
  const sharedEvents = [...s1.events, ...s2.events]
  ctx.assert('sharedReceived', count(sharedEvents, (e) => e.status === 'received'), 3)
  ctx.assert('sharedUnique', uniqueMessageIds(sharedEvents), 3)
  ctx.assert('sharedS1GotMessages', count(s1.events, (e) => e.status === 'received') > 0, true)
  ctx.assert('sharedS2GotMessages', count(s2.events, (e) => e.status === 'received') > 0, true)

  // Failover：主消费者收全量，备份消费者 0 条；主退出后备份提升为主继续收全量。
  const dbF1 = path.join(ctx.workDir, 'idempotency-failover-primary.db')
  const dbF2 = path.join(ctx.workDir, 'idempotency-failover-replica.db')
  const [primaryPromise, replicaPromise] = [
    ctx.runJava(
      ['consume', `--topic=${TOPIC.subs}`, `--subscription=${SUB.failover}`, '--sub-type=Failover', `--db=${dbF1}`, '--lab=subscriptions', '--consumer=a-primary', '--expected=3'],
      { label: 'consumer:failover-primary' },
    ),
    ctx.runJava(
      ['consume', `--topic=${TOPIC.subs}`, `--subscription=${SUB.failover}`, '--sub-type=Failover', `--db=${dbF2}`, '--lab=subscriptions', '--consumer=b-replica', '--idle-exit-ms=8000'],
      { label: 'consumer:failover-replica' },
    ),
  ]
  await ctx.runJava(
    ['produce', '--lab=subscriptions', `--topic=${TOPIC.subs}`, `--files=${ORDER_FILES}`],
    { label: 'producer:failover' },
  )
  const [primary, replica] = await Promise.all([primaryPromise, replicaPromise])
  ctx.assert('failoverPrimaryReceived', count(primary.events, (e) => e.status === 'received'), 3)
  ctx.assert('failoverReplicaReceived', count(replica.events, (e) => e.status === 'received'), 0)

  // 主已退出：备份再次订阅即成为主，收到新一轮全量消息（同一 messageId 用新 db）。
  const dbF3 = path.join(ctx.workDir, 'idempotency-failover-promoted.db')
  const promotedPromise = ctx.runJava(
    ['consume', `--topic=${TOPIC.subs}`, `--subscription=${SUB.failover}`, '--sub-type=Failover', `--db=${dbF3}`, '--lab=subscriptions', '--consumer=b-replica', '--expected=3'],
    { label: 'consumer:failover-promoted' },
  )
  await ctx.runJava(
    ['produce', '--lab=subscriptions', `--topic=${TOPIC.subs}`, `--files=${ORDER_FILES}`],
    { label: 'producer:failover-promoted' },
  )
  const promoted = await promotedPromise
  ctx.assert('failoverPromotedReceived', count(promoted.events, (e) => e.status === 'received'), 3)

  // Key_Shared：同 key 粘连同一消费者。两个 key 各发 3 条（repeat=3 生成新 messageId）。
  const dbK1 = path.join(ctx.workDir, 'idempotency-keyshared-1.db')
  const dbK2 = path.join(ctx.workDir, 'idempotency-keyshared-2.db')
  const [k1Promise, k2Promise] = [
    ctx.runJava(
      ['consume', `--topic=${TOPIC.subs}`, `--subscription=${SUB.keyShared}`, '--sub-type=Key_Shared', `--db=${dbK1}`, '--lab=subscriptions', '--consumer=k-1', '--idle-exit-ms=8000'],
      { label: 'consumer:keyshared-1' },
    ),
    ctx.runJava(
      ['consume', `--topic=${TOPIC.subs}`, `--subscription=${SUB.keyShared}`, '--sub-type=Key_Shared', `--db=${dbK2}`, '--lab=subscriptions', '--consumer=k-2', '--idle-exit-ms=8000'],
      { label: 'consumer:keyshared-2' },
    ),
  ]
  await ctx.runJava(
    ['produce', '--lab=subscriptions', `--topic=${TOPIC.subs}`, '--files=order-1001.json,order-1002.json', '--repeat=3'],
    { label: 'producer:keyshared' },
  )
  const [k1, k2] = await Promise.all([k1Promise, k2Promise])
  const keyEvents = [...k1.events, ...k2.events].filter((e) => e.status === 'received')
  ctx.assert('keySharedReceived', keyEvents.length, 6)
  const consumersByAggregate = new Map()
  for (const e of keyEvents) {
    if (!consumersByAggregate.has(e.aggregateId)) consumersByAggregate.set(e.aggregateId, new Set())
    consumersByAggregate.get(e.aggregateId).add(e.consumer)
  }
  const sameKeySticky = [...consumersByAggregate.values()].every((consumers) => consumers.size === 1)
  ctx.assert('keySharedSameKeySticky', sameKeySticky, true)
}

export async function redeliveryReplay(ctx) {
  await ctx.runJava(['setup', '--lab=redelivery-replay'])

  // Shared 订阅：order-poison 反复 negativeAck，达 maxRedeliver=2 后进 DLQ；order-1001 正常提交。
  const db = path.join(ctx.workDir, 'idempotency.db')
  const consumerPromise = ctx.runJava(
    ['consume', `--topic=${TOPIC.redelivery}`, `--subscription=${SUB.redeliver}`, '--sub-type=Shared', `--db=${db}`, '--lab=redelivery-replay', '--fail-aggregate=order-poison', '--max-redeliver=2', '--idle-exit-ms=10000'],
    { label: 'consumer' },
  )
  const producer = await ctx.runJava(
    ['produce', '--lab=redelivery-replay', `--topic=${TOPIC.redelivery}`, '--files=order-1001.json,poison-message.json'],
    { label: 'producer' },
  )
  const consumer = await consumerPromise

  ctx.assert('produced', count(producer.events, (e) => e.status === 'produced'), 2)
  ctx.assert('businessCommitted', count(consumer.events, (e) => e.status === 'business_committed'), 1)
  ctx.assert('redeliverRequested', count(consumer.events, (e) => e.status === 'redeliver_requested') >= 2, true)
  ctx.assert('consumerExitCode', consumer.exitCode, 0)

  // DLQ 检查：Pulsar DLQ topic 命名 <topic>-<subscription>-DLQ，恰好 1 条 poison。
  const dbDlq = path.join(ctx.workDir, 'idempotency-dlq.db')
  const dlq = await ctx.runJava(
    ['consume', `--topic=${TOPIC.redelivery}-${SUB.redeliver}-DLQ`, `--subscription=${SUB.dlqInspect}`, '--sub-type=Exclusive', `--db=${dbDlq}`, '--lab=redelivery-replay', '--consumer=dlq-1', '--expected=1'],
    { label: 'consumer:dlq' },
  )
  ctx.assert('dlqReceived', count(dlq.events, (e) => e.status === 'received'), 1)
  ctx.assert(
    'dlqIsPoison',
    count(dlq.events, (e) => e.status === 'received' && e.aggregateId === 'order-poison'),
    1,
  )

  // reset-cursor 到 earliest 后全量回放：order-1001 与 poison 再次被消费（新 db，poison 本轮不再失败）。
  await ctx.composeExec('pulsar', [
    'bin/pulsar-admin', 'topics', 'reset-cursor', FULL(TOPIC.redelivery),
    '--subscription', SUB.redeliver,
    '--message-id', 'earliest',
  ])
  const dbReplay = path.join(ctx.workDir, 'idempotency-replay.db')
  const replay = await ctx.runJava(
    ['consume', `--topic=${TOPIC.redelivery}`, `--subscription=${SUB.redeliver}`, '--sub-type=Shared', `--db=${dbReplay}`, '--lab=redelivery-replay', '--consumer=replay-1', '--expected=2'],
    { label: 'consumer:replay' },
  )
  ctx.assert('replayReceived', count(replay.events, (e) => e.status === 'received'), 2)
  ctx.assert('replayUniqueMessageIds', uniqueMessageIds(replay.events), 2)
  const inspectReplay = await ctx.runJava(['inspect-db', '--lab=redelivery-replay', `--db=${dbReplay}`], { label: 'inspect-db:replay' })
  ctx.assert('replayBusinessRows', Number(inspectReplay.events.find((e) => e.business_rows)?.business_rows ?? -1), 2)
}

export { redeliveryReplay as 'redelivery-replay' }
