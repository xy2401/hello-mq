import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { loadManifest, normalizeEol, ROOT } from './playground-evidence-lib.js'
import { normalizeSelected } from './normalize-playground-evidence.js'

function tool(name, args = ['--version']) {
  const result = spawnSync(name, args, { encoding: 'utf8', shell: false })
  if (result.error || result.status !== 0) throw new Error(`缺少采集依赖：${name}`)
  return normalizeEol(`${result.stdout}${result.stderr}`).trim().split('\n')[0]
}

function dockerCompose(entry, args) {
  const directory = path.join(ROOT, 'demos', entry.product, entry.id)
  const base = ['compose', '-p', `hello-mq-${entry.product}-${entry.id}`, '-f', path.join(directory, 'docker-compose.yml'), '--env-file', path.join(ROOT, '.env.versions')]
  const result = spawnSync('docker', [...base, ...args], { cwd: directory, encoding: 'utf8' })
  return { status: result.status, stdout: normalizeEol(result.stdout ?? ''), stderr: normalizeEol(result.stderr ?? '') }
}

function readTargets(entry) {
  const compose = fs.readFileSync(path.join(ROOT, 'demos', entry.product, entry.id, 'docker-compose.yml'), 'utf8')
  return {
    streams: [...compose.matchAll(/--stream=([A-Za-z0-9._-]+)/g)].map((match) => match[1]),
    groups: [...compose.matchAll(/--group=([A-Za-z0-9._-]+)/g)].map((match) => match[1]),
    topics: [...compose.matchAll(/--topic=([A-Za-z0-9._-]+)/g)].map((match) => match[1]),
  }
}

function captureRabbit(entry) {
  const queues = dockerCompose(entry, ['exec', '-T', 'rabbitmq', 'rabbitmqctl', 'list_queues', 'name', 'messages_ready', 'messages_unacknowledged', 'consumers', '--formatter=json'])
  const bindings = dockerCompose(entry, ['exec', '-T', 'rabbitmq', 'rabbitmqctl', 'list_bindings', 'source_name', 'destination_name', 'routing_key', '--formatter=json'])
  let values = []
  try { values = JSON.parse(queues.stdout) } catch {}
  return {
    ok: queues.status === 0 && bindings.status === 0,
    metrics: {
      messagesReady: values.reduce((sum, item) => sum + Number(item.messages_ready ?? 0), 0),
      messagesUnacknowledged: values.reduce((sum, item) => sum + Number(item.messages_unacknowledged ?? 0), 0),
      consumers: values.reduce((sum, item) => sum + Number(item.consumers ?? 0), 0),
      dlqDepth: values.filter((item) => /dlq|dead/i.test(item.name)).reduce((sum, item) => sum + Number(item.messages_ready ?? 0), 0),
    },
    commands: { queues: queues.stdout || queues.stderr, bindings: bindings.stdout || bindings.stderr },
  }
}

function parseKafkaDescribe(value) {
  const rows = value.split('\n').filter((line) => line.trim() && !line.includes('GROUP') && !line.startsWith('Consumer group'))
  let currentOffset = 0
  let endOffset = 0
  let lag = 0
  const members = new Set()
  for (const row of rows) {
    const columns = row.trim().split(/\s+/)
    if (columns.length < 6) continue
    currentOffset += Number(columns[3]) || 0
    endOffset += Number(columns[4]) || 0
    lag += Number(columns[5]) || 0
    if (columns[6] && columns[6] !== '-') members.add(columns[6])
  }
  return { currentOffset, endOffset, lag, members: members.size }
}

function captureKafka(entry) {
  const targets = readTargets(entry)
  const groups = [...new Set(targets.groups)]
  const topic = targets.topics[0]
  const topicDescription = topic
    ? dockerCompose(entry, ['exec', '-T', 'kafka', '/opt/kafka/bin/kafka-topics.sh', '--bootstrap-server', 'localhost:9092', '--describe', '--topic', topic])
    : { status: 1, stdout: '', stderr: 'topic not found in compose file' }
  const descriptions = groups.map((group) => ({
    group,
    result: dockerCompose(entry, ['exec', '-T', 'kafka', '/opt/kafka/bin/kafka-consumer-groups.sh', '--bootstrap-server', 'localhost:9092', '--describe', '--group', group]),
  }))
  const metrics = descriptions.reduce((total, item) => {
    const parsed = parseKafkaDescribe(item.result.stdout)
    for (const [key, value] of Object.entries(parsed)) total[key] = (total[key] ?? 0) + value
    return total
  }, {})
  return {
    ok: topicDescription.status === 0,
    metrics: { ...metrics, groups: groups.length, partitions: (topicDescription.stdout.match(/Partition:/g) ?? []).length },
    commands: { topic: topicDescription.stdout || topicDescription.stderr, ...Object.fromEntries(descriptions.map((item) => [item.group, item.result.stdout || item.result.stderr])) },
  }
}

function redisCommand(entry, ...args) {
  return dockerCompose(entry, ['exec', '-T', 'redis', 'redis-cli', '--raw', ...args])
}

function captureRedis(entry) {
  const targets = readTargets(entry)
  const stream = targets.streams[0] ?? 'orders'
  const group = targets.groups[0] ?? 'order-service'
  const length = redisCommand(entry, 'XLEN', stream)
  const pending = redisCommand(entry, 'XPENDING', stream, group)
  const groups = redisCommand(entry, 'XINFO', 'GROUPS', stream)
  const consumers = redisCommand(entry, 'XINFO', 'CONSUMERS', stream, group)
  const details = redisCommand(entry, 'XPENDING', stream, group, '-', '+', '100')
  const pendingCount = Number(pending.stdout.trim().split('\n')[0]) || 0
  return {
    ok: length.status === 0 && pending.status === 0,
    metrics: { streamLength: Number(length.stdout.trim()) || 0, pending: pendingCount },
    commands: { xlen: length.stdout || length.stderr, xpending: pending.stdout || pending.stderr, groups: groups.stdout || groups.stderr, consumers: consumers.stdout || consumers.stderr, pel: details.stdout || details.stderr },
  }
}

function captureBroker(entry) {
  if (entry.product === 'rabbitmq') return captureRabbit(entry)
  if (entry.product === 'kafka') return captureKafka(entry)
  return captureRedis(entry)
}

async function collect(entry, versions) {
  const directory = path.join(ROOT, 'demos', entry.product, entry.id)
  const gate = path.join(directory, '.replay-gate')
  const rawFile = path.join(directory, 'replay.raw.jsonl')
  const captureFile = path.join(directory, 'capture.json')
  const replayFile = path.join(directory, 'replay.json')
  fs.rmSync(gate, { recursive: true, force: true })
  fs.mkdirSync(gate, { recursive: true })
  for (const file of [rawFile, captureFile, replayFile]) fs.rmSync(file, { force: true })

  console.log(`\n=== ${entry.product}/${entry.id} ===`)
  const child = spawn('bash', ['run.sh'], {
    cwd: directory,
    env: { ...process.env, HELLO_MQ_REPLAY_CAPTURE: '1' },
    stdio: ['ignore', 'inherit', 'inherit'],
  })
  const handled = new Set()
  const watcher = setInterval(() => {
    if (!fs.existsSync(gate)) return
    for (const name of fs.readdirSync(gate).filter((name) => name.endsWith('.reached')).sort()) {
      if (handled.has(name)) continue
      handled.add(name)
      const checkpointText = normalizeEol(fs.readFileSync(path.join(gate, name), 'utf8')).trim()
      const fields = Object.fromEntries([...checkpointText.matchAll(/(?:^|\s)([A-Za-z][\w.-]*)=([^\s]+)/g)].map((match) => [match[1], match[2]]))
      let state
      try {
        state = captureBroker(entry)
      } catch (error) {
        state = { ok: false, metrics: {}, commands: { error: error instanceof Error ? error.message : String(error) } }
      }
      fs.appendFileSync(rawFile, `${JSON.stringify({ kind: 'broker-state', timestamp: new Date().toISOString(), checkpoint: fields.checkpoint ?? name, messageId: fields.messageId, adapterOk: state.ok, metrics: state.metrics, commands: state.commands })}\n`)
      fs.writeFileSync(path.join(gate, name.replace(/\.reached$/, '.release')), 'release\n')
    }
  }, 150)

  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })
  clearInterval(watcher)
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).stdout?.trim() ?? null
  fs.writeFileSync(captureFile, `${JSON.stringify({ capturedAt: new Date().toISOString(), exitCode, tools: versions, sourceRevision: revision }, null, 2)}\n`)
  try {
    normalizeSelected({ scenario: `${entry.product}/${entry.id}` })
  } finally {
    fs.rmSync(gate, { recursive: true, force: true })
  }
  if (exitCode !== 0) throw new Error(`${entry.product}/${entry.id} 采集失败，退出码 ${exitCode}`)
}

const productAt = process.argv.indexOf('--product')
const scenarioAt = process.argv.indexOf('--scenario')
const positional = process.argv.slice(2).filter((argument) => !argument.startsWith('-'))
const positionalScenario = positional.find((argument) => argument.includes('/'))
const positionalProduct = positional.find((argument) => ['rabbitmq', 'kafka', 'redis-streams'].includes(argument))
const filter = {
  product: productAt >= 0 ? process.argv[productAt + 1] : positionalProduct,
  scenario: scenarioAt >= 0 ? process.argv[scenarioAt + 1] : positionalScenario,
}
const manifest = loadManifest()
const requested = manifest.filter((entry) =>
  (!filter.product || entry.product === filter.product)
  && (!filter.scenario || `${entry.product}/${entry.id}` === filter.scenario),
)
if (requested.length === 0) throw new Error('没有匹配的 playground 场景')
const selected = []
for (const entry of requested) {
  if (entry.id === 'consumer-crash') {
    const basic = manifest.find((candidate) => candidate.product === entry.product && candidate.id === 'basic')
    if (basic && !selected.some((candidate) => candidate.product === basic.product && candidate.id === basic.id)) selected.push(basic)
  }
  if (!selected.some((candidate) => candidate.product === entry.product && candidate.id === entry.id)) selected.push(entry)
}
const versions = {
  docker: tool('docker'),
  compose: tool('docker', ['compose', 'version']),
  bash: tool('bash', ['--version']),
  maven: tool('mvn', ['--version']),
  jq: tool('jq'),
}
for (const entry of selected) await collect(entry, versions)
