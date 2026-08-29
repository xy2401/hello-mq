import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const MANIFEST = path.join(ROOT, 'demos', 'playground-scenarios.json')

export function normalizeEol(value) {
  return value.replace(/\r\n?/g, '\n')
}

export function hashLine(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

/** Parse key=value logs by key boundaries so values may contain ordinary spaces. */
export function parseStructuredLine(line) {
  const normalized = normalizeEol(line).replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
  const roleMatch = normalized.match(/^\[([^\]]+)]\s*/)
  const fields = {}
  const matches = [...normalized.matchAll(/(?:^|\s)([A-Za-z][A-Za-z0-9_.-]*)=/g)]
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const valueStart = match.index + match[0].length
    const valueEnd = index + 1 < matches.length ? matches[index + 1].index : normalized.length
    fields[match[1]] = normalized.slice(valueStart, valueEnd).trim()
  }
  return { role: roleMatch?.[1] ?? 'unknown', fields, line: normalized }
}

export function evidenceRef(file, line, content, role) {
  return {
    file: path.relative(ROOT, file).split(path.sep).join('/'),
    line,
    hash: hashLine(content),
    role,
    content,
  }
}

function topology(product) {
  const middle = product === 'rabbitmq' ? ['Exchange', 'Queue'] : product === 'kafka' ? ['Topic', 'Partition'] : ['Stream', 'Consumer Group']
  return [
    { id: 'producer', label: 'Producer', kind: 'producer', status: 'idle' },
    { id: 'broker', label: middle[0], kind: 'broker', status: 'idle' },
    { id: 'queue', label: middle[1], kind: 'queue', status: 'idle' },
    { id: 'consumer', label: 'Consumer', kind: 'consumer', status: 'idle' },
    { id: 'database', label: '业务数据库', kind: 'database', status: 'idle' },
  ]
}

function emptyState(product) {
  return { nodes: topology(product), message: {}, metrics: {}, business: {} }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function number(value) {
  if (value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : value
}

function node(state, id, status) {
  const target = state.nodes.find((item) => item.id === id)
  if (target) target.status = status
}

export function applyEvent(previous, record) {
  const state = clone(previous)
  const fields = record.fields ?? {}
  if (record.kind === 'broker-state') {
    Object.assign(state.metrics, record.metrics ?? {})
    node(state, 'broker', 'active')
    return state
  }

  const status = fields.status ?? record.type
  state.message = {
    messageId: fields.messageId ?? state.message.messageId,
    location: status === 'confirmed' ? 'broker' : status === 'received' ? 'consumer' : status?.includes('business') ? 'database' : state.message.location,
    attempt: number(fields.attempt) ?? state.message.attempt,
    redelivered: fields.redelivered === undefined ? state.message.redelivered : fields.redelivered === 'true',
    queue: fields.queue ?? fields.destination ?? fields.stream ?? state.message.queue,
    partition: fields.partitionOrQueue ?? state.message.partition,
    offset: number(fields.offset) ?? state.message.offset,
    consumer: fields.consumer ?? state.message.consumer,
    status,
  }
  if (fields.business_rows !== undefined) state.business.businessRows = number(fields.business_rows)
  if (fields.idempotency_rows !== undefined) state.business.idempotencyRows = number(fields.idempotency_rows)
  if (status === 'confirmed' || status === 'published') node(state, 'producer', 'done')
  if (status === 'received' || status === 'assigned') node(state, 'consumer', 'active')
  if (status === 'business_committed' || status === 'duplicate_skipped') node(state, 'database', 'done')
  if (status === 'crash_injected') node(state, 'consumer', 'failed')
  if (status === 'done') node(state, 'consumer', 'done')
  if (status === 'waiting') node(state, 'consumer', 'waiting')
  return state
}

function eventTitle(record) {
  const status = record.fields?.status ?? record.type ?? record.checkpoint
  const labels = {
    confirmed: 'Broker 已确认发布', received: 'Consumer 收到消息', business_committed: '业务事务已提交',
    duplicate_skipped: '幂等表拦截重复消息', crash_injected: 'Consumer 在确认前崩溃', retry: '消息进入重试环',
    poison_to_dlq: '毒消息进入 DLQ', assigned: '消费组完成分区分配', done: 'Consumer 完成处理',
    waiting: 'Consumer 到达证据检查点', released: '采集完成，解除门闩',
  }
  return labels[status] ?? (record.checkpoint ? `Broker 状态：${record.checkpoint}` : status ?? '日志事件')
}

function assignedTrack(product, scenario, record, expected) {
  const status = String(record.fields?.status ?? record.checkpoint ?? '').toLowerCase()
  const role = String(record.fileRole ?? record.role ?? '').toLowerCase()
  const fields = record.fields ?? {}
  if (scenario === 'consumer-crash') {
    if (product === 'redis-streams') return role.includes('run2') || fields.redelivered === 'true' || status.includes('claim') ? 'claim' : 'crash'
    return role.includes('run2') || fields.redelivered === 'true' || status.includes('duplicate') || status.includes('recover') ? 'recovery' : 'crash'
  }
  if (scenario === 'retry-dlq') {
    if (status.includes('dlq')) return 'dlq'
    if (status.includes('retry') || Number(fields.attempt ?? 1) > 1) return 'poison'
    return 'normal'
  }
  if (scenario === 'backlog-recovery') return role.includes('consumer') || status.includes('recover') ? 'recovery' : 'offline'
  if (scenario === 'ordering-replay') return /replay|second|group-b|consumer-b|consumer-g2|\bg2\b/.test(`${role} ${JSON.stringify(fields)}`) ? 'replay' : 'initial'
  if (scenario === 'idempotence-transaction') return /abort|aborted/.test(`${status} ${JSON.stringify(fields)}`) ? 'abort' : 'commit'
  return expected[0] ?? 'observed'
}

function trackLabel(product, scenario, id) {
  const labels = {
    'rabbitmq/consumer-crash/crash': 'ACK 前崩溃',
    'rabbitmq/consumer-crash/normal': '正常 ACK',
    'rabbitmq/consumer-crash/recovery': '恢复并重投',
    'rabbitmq/retry-dlq/normal': '正常消息',
    'rabbitmq/retry-dlq/poison': '毒消息重试',
    'rabbitmq/retry-dlq/dlq': '进入 DLQ',
    'rabbitmq/backlog-recovery/offline': '消费者离线',
    'rabbitmq/backlog-recovery/recovery': '启动消费者追赶',
    'kafka/ordering-replay/initial': '首次消费',
    'kafka/ordering-replay/replay': '从 offset 0 回放',
    'kafka/idempotence-transaction/commit': '事务提交',
    'kafka/idempotence-transaction/abort': '事务中止',
    'redis-streams/consumer-crash/crash': '崩溃进入 PEL',
    'redis-streams/consumer-crash/normal': '正常 XACK',
    'redis-streams/consumer-crash/claim': 'XCLAIM 接管',
    'rabbitmq/basic/observed': '实际收发',
    'rabbitmq/routing/observed': '实际路由',
    'kafka/basic/observed': '实际收发',
    'kafka/consumer-group/observed': '实际分配',
    'redis-streams/basic/observed': '实际收发',
  }
  return labels[`${product}/${scenario}/${id}`] ?? id
}

function timestampOf(record, fallback) {
  const raw = record.timestamp ?? record.fields?.timestamp
  const parsed = raw ? Date.parse(raw) : Number.NaN
  return Number.isFinite(parsed) ? parsed : fallback
}

function readLogRecords(directory) {
  const records = []
  let fallback = Date.now()
  for (const name of fs.readdirSync(directory).filter((name) => name.endsWith('.out.txt') && name !== 'assert.out.txt').sort()) {
    const file = path.join(directory, name)
    const lines = normalizeEol(fs.readFileSync(file, 'utf8')).split('\n')
    lines.forEach((content, index) => {
      if (!content.trim()) return
      const parsed = parseStructuredLine(content)
      if (!parsed.fields.timestamp && !parsed.fields.status) return
      records.push({
        kind: 'log',
        type: parsed.fields.status ?? 'log',
        ...parsed,
        fileRole: name.slice(0, -'.out.txt'.length),
        time: timestampOf(parsed, fallback++),
        evidence: [evidenceRef(file, index + 1, content, name.slice(0, -'.out.txt'.length))],
      })
    })
  }
  return records
}

function readRawRecords(directory) {
  const file = path.join(directory, 'replay.raw.jsonl')
  if (!fs.existsSync(file)) return []
  return normalizeEol(fs.readFileSync(file, 'utf8')).split('\n').flatMap((content, index) => {
    if (!content.trim()) return []
    const record = JSON.parse(content)
    return [{ ...record, time: timestampOf(record, Date.now() + index), evidence: [evidenceRef(file, index + 1, content, 'broker-state')] }]
  })
}

function readAssertions(directory) {
  const file = path.join(directory, 'assert.out.txt')
  if (!fs.existsSync(file)) return []
  return normalizeEol(fs.readFileSync(file, 'utf8')).split('\n').flatMap((content, index) =>
    content.trim() ? [evidenceRef(file, index + 1, content, 'assert')] : [],
  )
}

function readImage(product) {
  const key = product === 'rabbitmq' ? 'RABBITMQ_IMAGE' : product === 'kafka' ? 'KAFKA_IMAGE' : 'REDIS_IMAGE'
  const env = normalizeEol(fs.readFileSync(path.join(ROOT, '.env.versions'), 'utf8'))
  const value = env.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1] ?? ''
  const [reference, digest = ''] = value.split('@sha256:')
  return { reference, digest: digest ? `sha256:${digest}` : '' }
}

export function normalizeScenario(manifestEntry) {
  const directory = path.join(ROOT, 'demos', manifestEntry.product, manifestEntry.id)
  const captureFile = path.join(directory, 'capture.json')
  if (!fs.existsSync(captureFile)) throw new Error(`missing ${path.relative(ROOT, captureFile)}`)
  const capture = JSON.parse(normalizeEol(fs.readFileSync(captureFile, 'utf8')))
  const assertions = readAssertions(directory)
  const records = [...readLogRecords(directory), ...readRawRecords(directory)].sort((a, b) => a.time - b.time)
  const started = records[0]?.time ?? Date.now()
  const byTrack = new Map(manifestEntry.expectedTracks.map((id) => [id, []]))
  for (const record of records) {
    const id = assignedTrack(manifestEntry.product, manifestEntry.id, record, manifestEntry.expectedTracks)
    if (!byTrack.has(id)) byTrack.set(id, [])
    byTrack.get(id).push(record)
  }

  // “正常确认”轨道复用同一产品 basic 实验的真实证据，不在浏览器内推演另一种结果。
  if (manifestEntry.id === 'consumer-crash' && byTrack.has('normal') && byTrack.get('normal').length === 0) {
    const basicDirectory = path.join(ROOT, 'demos', manifestEntry.product, 'basic')
    byTrack.set('normal', [...readLogRecords(basicDirectory), ...readRawRecords(basicDirectory)].sort((a, b) => a.time - b.time))
  }

  const tracks = [...byTrack].map(([id, trackRecords]) => {
    let state = emptyState(manifestEntry.product)
    const trackStarted = trackRecords[0]?.time ?? started
    const events = trackRecords.map((record, index) => {
      state = applyEvent(state, record)
      return {
        sequence: index,
        relativeMs: Math.max(0, record.time - trackStarted),
        delayMs: index === 0 ? 0 : Math.min(1600, Math.max(250, record.time - trackRecords[index - 1].time)),
        actor: record.fileRole ?? record.role ?? 'broker',
        type: record.fields?.status ?? record.checkpoint ?? record.type ?? 'state',
        title: eventTitle(record),
        track: id,
        messageId: record.fields?.messageId ?? record.messageId,
        state: clone(state),
        evidence: record.evidence,
      }
    })
    const label = trackLabel(manifestEntry.product, manifestEntry.id, id)
    return { id, label, description: `Docker 采集轨道：${label}`, events }
  })

  tracks.forEach((current, index) => {
    const target = tracks[index + 1]
    if (!target || current.events.length === 0 || target.events.length === 0) return
    current.events.at(-1).actions = [{ id: `switch-${target.id}`, label: target.label, targetTrack: target.id, targetStep: 0 }]
    target.branchFrom = { track: current.id, step: current.events.length - 1 }
  })

  const hasPassed = assertions.some((item) => item.content === 'RESULT: all assertions passed')
  const hasBrokerState = records.some((item) => item.kind === 'broker-state' && item.adapterOk === true)
  const completeTracks = tracks.every((item) => item.events.length > 0)
  const verified = capture.exitCode === 0 && hasPassed && hasBrokerState && completeTracks
  return {
    schemaVersion: 1,
    id: manifestEntry.id,
    product: manifestEntry.product,
    title: manifestEntry.title,
    model: manifestEntry.model,
    description: manifestEntry.description,
    evidenceStatus: verified ? 'verified' : 'failed',
    image: readImage(manifestEntry.product),
    capture,
    topology: topology(manifestEntry.product),
    defaultTrack: tracks.find((item) => item.events.length > 0)?.id ?? manifestEntry.expectedTracks[0],
    tracks,
    assertions,
    document: manifestEntry.document,
  }
}

export function loadManifest() {
  return JSON.parse(normalizeEol(fs.readFileSync(MANIFEST, 'utf8')))
}
