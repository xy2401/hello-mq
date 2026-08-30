import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { evidenceRef, hashLine, loadManifest, normalizeEol, parseStructuredLine, ROOT } from './playground-evidence-lib.js'
import { clampReplayStep, moveReplayStep, resolveReplayAction } from '../docs/.vitepress/theme/data/replay-player.js'

const strict = process.argv.includes('--require-evidence')
const manifest = loadManifest()
const expected = { rabbitmq: 5, kafka: 4, 'redis-streams': 2 }
assert.equal(manifest.length, 11, 'playground 必须声明 11 个首版场景')
for (const [product, count] of Object.entries(expected)) {
  assert.equal(manifest.filter((entry) => entry.product === product).length, count, `${product} 场景数错误`)
}

const parsed = parseStructuredLine('[consumer] timestamp=2026-08-29T00:00:00Z status=failed reason=value with spaces next=ok')
assert.equal(parsed.fields.reason, 'value with spaces')
assert.equal(parsed.fields.next, 'ok')
assert.equal(normalizeEol('a\r\nb\rc'), 'a\nb\nc')
assert.equal(parseStructuredLine('\u001b[31m[consumer] status=received\u001b[0m').fields.status, 'received')
const playerEvents = [{ sequence: 0 }, { sequence: 1 }, { sequence: 2 }]
assert.equal(moveReplayStep(playerEvents, 0, 1), 1, '前进失败')
assert.equal(moveReplayStep(playerEvents, 0, -1), 0, '回退下界失败')
assert.equal(clampReplayStep(playerEvents, 99), 2, '跳转上界失败')
assert.deepEqual(
  resolveReplayAction([{ id: 'recovery', events: playerEvents }], { targetTrack: 'recovery', targetStep: 1 }),
  { track: 'recovery', step: 1 },
  '分支切换失败',
)

let pending = 0
for (const entry of manifest) {
  const key = `${entry.product}/${entry.id}`
  assert.match(entry.document, /^\/products\//, `${key}: 实验说明必须归入对应产品正文`)
  const documentPath = entry.document.split('#')[0]
  assert.ok(fs.existsSync(path.join(ROOT, 'docs', `${documentPath.slice(1)}.md`)), `${key}: 产品说明不存在 ${documentPath}`)
  const directory = path.join(ROOT, 'demos', entry.product, entry.id)
  assert.ok(fs.existsSync(path.join(directory, 'run.sh')), `${key}: 缺少 run.sh`)
  const composeFile = path.join(directory, 'docker-compose.yml')
  assert.ok(fs.existsSync(composeFile), `${key}: 缺少 docker-compose.yml`)
  const compose = fs.readFileSync(composeFile, 'utf8')
  assert.match(compose, /HELLO_MQ_REPLAY_CAPTURE/, `${key}: Compose 未接入采集开关`)
  assert.match(compose, /\.replay-gate:\/replay-gate/, `${key}: Compose 未挂载 ReplayGate`)

  const replayFile = path.join(directory, 'replay.json')
  if (!fs.existsSync(replayFile)) {
    pending += 1
    if (strict) assert.fail(`${key}: 尚未采集 replay.json`)
    continue
  }
  const replay = JSON.parse(normalizeEol(fs.readFileSync(replayFile, 'utf8')))
  assert.equal(replay.schemaVersion, 1, `${key}: schemaVersion`)
  assert.equal(replay.product, entry.product, `${key}: product`)
  assert.equal(replay.id, entry.id, `${key}: id`)
  assert.equal(replay.evidenceStatus, 'verified', `${key}: 证据未通过完整性检查`)
  assert.ok(replay.capture.capturedAt && replay.capture.exitCode === 0, `${key}: 采集元数据不完整`)
  assert.match(replay.image.digest, /^sha256:[a-f0-9]{64}$/, `${key}: 镜像 digest 无效`)
  assert.ok(replay.assertions.some((item) => item.content === 'RESULT: all assertions passed'), `${key}: 最终断言未通过`)
  assert.deepEqual(replay.tracks.map((track) => track.id).sort(), [...entry.expectedTracks].sort(), `${key}: 轨道不完整`)
  const requiredMetrics = entry.product === 'rabbitmq'
    ? ['messagesReady', 'messagesUnacknowledged', 'consumers', 'dlqDepth']
    : entry.product === 'kafka'
      ? ['currentOffset', 'endOffset', 'lag', 'members', 'partitions']
      : ['streamLength', 'pending']
  const metricKeys = new Set(replay.tracks.flatMap((track) => track.events.flatMap((event) => Object.keys(event.state.metrics))))
  for (const metric of requiredMetrics) assert.ok(metricKeys.has(metric), `${key}: 缺少 Broker 指标 ${metric}`)
  for (const track of replay.tracks) {
    assert.ok(track.events.length > 0, `${key}/${track.id}: 空轨道`)
    for (const event of track.events) {
      assert.ok(event.state && Array.isArray(event.state.nodes), `${key}/${track.id}: 缺少完整状态`)
      for (const ref of event.evidence) {
        const source = path.join(ROOT, ref.file)
        assert.ok(fs.existsSync(source), `${key}: 证据源不存在 ${ref.file}`)
        const line = normalizeEol(fs.readFileSync(source, 'utf8')).split('\n')[ref.line - 1]
        assert.equal(line, ref.content, `${key}: 证据行内容不一致 ${ref.file}:${ref.line}`)
        assert.equal(hashLine(line), ref.hash, `${key}: 证据哈希不一致 ${ref.file}:${ref.line}`)
      }
      for (const action of event.actions ?? []) {
        assert.ok(replay.tracks.some((candidate) => candidate.id === action.targetTrack && candidate.events[action.targetStep]), `${key}: 操作 ${action.id} 没有真实目标轨道`)
      }
    }
  }
}

const index = fs.readFileSync(path.join(ROOT, 'docs', 'playground', 'index.md'), 'utf8')
assert.equal((index.match(/<MqPlayground\s*\/>/g) ?? []).length, 1, 'playground/index.md 必须且只能加载一个 MqPlayground')
assert.ok(!index.includes('<LabOutput'), '交互总入口不应退化为静态 LabOutput')
const playgroundDocs = fs.readdirSync(path.join(ROOT, 'docs', 'playground')).filter((file) => file.endsWith('.md'))
assert.deepEqual(playgroundDocs, ['index.md', 'kafka.md', 'rabbitmq.md', 'redis-streams.md'], 'playground 只保留总入口和按产品拆分的演示页')
for (const product of Object.keys(expected)) {
  const page = fs.readFileSync(path.join(ROOT, 'docs', 'playground', `${product}.md`), 'utf8')
  assert.equal((page.match(new RegExp(`<MqPlayground\\s+product="${product}"\\s*\\/>`, 'g')) ?? []).length, 1, `${product} 演示页必须加载固定产品的 MqPlayground`)
  assert.ok(!page.includes('<LabOutput'), `${product} 演示页不应退化为说明文档`)
}

console.log(`playground infrastructure: PASS; verified=${manifest.length - pending}; pending=${pending}`)
if (pending && !strict) console.warn('Docker 证据尚未补采；npm run check:playground 将执行严格校验。')
