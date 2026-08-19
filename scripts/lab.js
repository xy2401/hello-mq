#!/usr/bin/env node
// hello-mq 实验统一入口（规格 §9.3 / §9.4）。
// 用法：
//   node scripts/lab.js list
//   node scripts/lab.js <product> <lab|all|clean> [--keep] [--rebuild]
//   node scripts/lab.js collect <product>
//   node scripts/lab.js verify

import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { normalizeOutput, parseSnapshot, renderSnapshot } from './normalize-output.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DOCKER_TIMEOUT_S = 90

function log(msg) {
  console.log(`[lab] ${msg}`)
}

function fail(msg) {
  throw new Error(msg)
}

function parseEnvVersions() {
  const file = path.join(ROOT, '.env.versions')
  if (!fs.existsSync(file)) fail('.env.versions not found')
  const env = {}
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx < 0) continue
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
  }
  for (const [key, value] of Object.entries(env)) {
    if (!key.endsWith('_IMAGE')) continue
    if (/(:|-)latest($|[,@])/.test(value) || /:edge|:nightly/.test(value)) {
      fail(`${key} uses a floating tag: ${value}`)
    }
    if (!value.includes('@sha256:')) {
      fail(`${key} must be pinned with an @sha256 digest: ${value}`)
    }
  }
  return env
}

function brokerVersionFromImage(image) {
  const m = image.match(/:(\d+\.\d+\.\d+)/)
  return m ? m[1] : 'unknown'
}

function listProducts() {
  const demosDir = path.join(ROOT, 'demos')
  return fs
    .readdirSync(demosDir)
    .filter((d) => fs.existsSync(path.join(demosDir, d, 'labs.json')))
    .sort()
}

function loadRegistry(product) {
  const registryFile = path.join(ROOT, 'demos', product, 'labs.json')
  if (!fs.existsSync(registryFile)) {
    fail(`unknown product: ${product} (no demos/${product}/labs.json)`)
  }
  const registry = JSON.parse(fs.readFileSync(registryFile, 'utf8'))
  const orchestrationFile = path.join(ROOT, 'demos', product, 'labs.mjs')
  if (!fs.existsSync(orchestrationFile)) fail(`missing ${orchestrationFile}`)
  return { registry, orchestrationFile }
}

function ensureJar(product, { rebuild = false } = {}) {
  const jar = path.join(ROOT, 'demos', product, 'target', `hello-mq-${product}.jar`)
  if (fs.existsSync(jar) && !rebuild) return jar
  log(`building demos/${product} (mvn package)...`)
  const res = spawnSync(
    'mvn',
    ['-B', '-q', '-f', path.join(ROOT, 'demos', 'pom.xml'), '-pl', product, '-am', 'package', '-DskipTests'],
    { stdio: 'inherit', cwd: ROOT },
  )
  if (res.status !== 0) fail('maven build failed')
  if (!fs.existsSync(jar)) fail(`expected jar not found: ${jar}`)
  return jar
}

function spawnAsync(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: ROOT, ...opts })
    const stdoutLines = []
    const stderrLines = []
    child.stdout.on('data', (d) => {
      for (const line of d.toString().split('\n')) {
        if (line.trim()) {
          stdoutLines.push(line)
          if (opts.echoStdout !== false) console.log(line)
        }
      }
    })
    child.stderr.on('data', (d) => {
      for (const line of d.toString().split('\n')) {
        if (line.trim()) stderrLines.push(line)
      }
    })
    child.on('close', (exitCode) => resolve({ exitCode: exitCode ?? -1, stdoutLines, stderrLines }))
  })
}

export function parseStructuredLine(line) {
  const m = line.match(/^\[(\w+)\]\s+(.*)$/)
  if (!m) return null
  const event = { role: m[1] }
  for (const kv of m[2].matchAll(/(\w+)=(\S+)/g)) {
    event[kv[1]] = kv[2]
  }
  return event
}

function makeCtx({ product, lab, registry, envVersions, jar, opts }) {
  const composeProject = `hello-mq-${product}-${lab.name}`
  const composeFile = path.join(ROOT, registry.compose)
  const workDir = path.join(ROOT, '.lab', product, lab.name)
  const diagnosticsDir = path.join(workDir, 'diagnostics')
  const service = registry.service || fail(`labs.json for ${product} must declare "service"`)
  const imageEnvKey = registry.imageEnvKey || fail(`labs.json for ${product} must declare "imageEnvKey"`)
  const healthTimeout = registry.healthTimeout ?? DOCKER_TIMEOUT_S

  const ctx = {
    product,
    lab,
    root: ROOT,
    workDir,
    jar,
    composeProject,
    envVersions,
    service,
    image: envVersions[imageEnvKey] || fail(`.env.versions has no ${imageEnvKey}`),
    client: registry.client,
    assertions: {},
    failures: 0,
    bodyLines: [],
  }

  ctx.resetWorkDir = () => {
    fs.rmSync(workDir, { recursive: true, force: true })
    fs.mkdirSync(diagnosticsDir, { recursive: true })
  }

  ctx.compose = async (args) => {
    const res = await spawnAsync(
      'docker',
      ['compose', '-p', composeProject, '--env-file', path.join(ROOT, '.env.versions'), '-f', composeFile, ...args],
      { echoStdout: false },
    )
    return res
  }

  ctx.up = async () => {
    log(`compose up (${composeProject})`)
    const res = await ctx.compose(['up', '-d', '--remove-orphans'])
    if (res.exitCode !== 0) fail(`compose up failed:\n${res.stderrLines.join('\n')}`)
  }

  ctx.down = async () => {
    log(`compose down (${composeProject})`)
    await ctx.compose(['down', '--volumes', '--remove-orphans', '--timeout', '10'])
  }

  ctx.captureBrokerLogs = async () => {
    const res = await ctx.compose(['logs', '--no-color'])
    fs.writeFileSync(path.join(diagnosticsDir, 'broker.log'), [...res.stdoutLines, ...res.stderrLines].join('\n'))
  }

  ctx.waitForService = async (name = service, timeoutS = healthTimeout) => {
    log(`waiting for ${name} to become healthy (poll container healthcheck, timeout ${timeoutS}s)`)
    const res = await spawnAsync(
      'node',
      [
        path.join(ROOT, 'scripts', 'wait-for-service.js'),
        composeProject,
        composeFile,
        name,
        String(timeoutS),
        path.join(ROOT, '.env.versions'),
      ],
      { echoStdout: false },
    )
    if (res.exitCode !== 0) {
      await ctx.captureBrokerLogs()
      fail(`service ${name} not healthy within ${timeoutS}s; see ${diagnosticsDir}/broker.log`)
    }
    log(`${name} is ready`)
  }

  ctx.runJava = async (args, { allowNonZero = false, label = 'java' } = {}) => {
    const res = await spawnAsync('java', ['-jar', jar, ...args])
    const events = []
    for (const line of res.stdoutLines) {
      ctx.bodyLines.push(line)
      const event = parseStructuredLine(line)
      if (event) events.push(event)
    }
    if (res.exitCode !== 0 && !allowNonZero) {
      fail(`${label} exited with ${res.exitCode}:\n${res.stderrLines.join('\n')}`)
    }
    return { exitCode: res.exitCode, events, stderrLines: res.stderrLines }
  }

  ctx.composeExec = async (serviceName, args, { allowNonZero = false } = {}) => {
    const res = await ctx.compose(['exec', '-T', serviceName, ...args])
    if (res.exitCode !== 0 && !allowNonZero) {
      fail(`exec ${serviceName} ${args.join(' ')} failed (exit ${res.exitCode}):\n${res.stderrLines.join('\n')}`)
    }
    return { exitCode: res.exitCode, stdout: res.stdoutLines.join('\n'), stderr: res.stderrLines.join('\n') }
  }

  ctx.assert = (name, actual, expected) => {
    const pass = JSON.stringify(actual) === JSON.stringify(expected)
    ctx.assertions[name] = actual
    if (!pass) {
      ctx.failures += 1
      console.log(`[assert] ${name}=${actual} FAIL (expected ${JSON.stringify(expected)})`)
    } else {
      console.log(`[assert] ${name}=${actual} PASS`)
    }
    ctx.bodyLines.push(`[assert] ${name}=${actual} ${pass ? 'PASS' : 'FAIL'}`)
    return pass
  }

  ctx.compareWithCommittedSnapshot = () => {
    const file = path.join(ROOT, 'outputs', product, `${lab.name}.snapshot`)
    if (!fs.existsSync(file)) return true
    const snap = parseSnapshot(fs.readFileSync(file, 'utf8'))
    let ok = true
    for (const [key, value] of Object.entries(snap.frontmatter.assertions ?? {})) {
      const current = ctx.assertions[key]
      if (JSON.stringify(current) !== JSON.stringify(value)) {
        ok = false
        console.log(`[assert] snapshot-match:${key}=${current} FAIL (committed snapshot has ${JSON.stringify(value)})`)
      }
    }
    if (ok) console.log('[assert] snapshot-match=committed PASS')
    return ok
  }

  ctx.writeSnapshot = ({ exitCode, durationMs }) => {
    const content = renderSnapshot({
      frontmatter: {
        status: ctx.failures === 0 ? 'verified' : 'failed',
        product,
        lab: lab.name,
        brokerVersion: brokerVersionFromImage(ctx.image),
        image: ctx.image,
        client: registry.client,
        capturedAt: new Date().toISOString(),
        durationMs,
        exitCode,
        assertions: ctx.assertions,
      },
      body: normalizeOutput(ctx.bodyLines.join('\n')),
    })
    const outDir = path.join(ROOT, 'outputs', product)
    fs.mkdirSync(outDir, { recursive: true })
    fs.writeFileSync(path.join(outDir, `${lab.name}.snapshot`), content)
    log(`snapshot written: outputs/${product}/${lab.name}.snapshot`)
  }

  ctx.opts = opts
  return ctx
}

async function runLab(product, labName, opts) {
  const { registry, orchestrationFile } = loadRegistry(product)
  const lab = registry.labs.find((l) => l.name === labName)
  if (!lab) fail(`unknown lab: ${product} ${labName}`)
  if (lab.level !== 'L1' && lab.level !== 'L2') {
    fail(`lab ${labName} is ${lab.level}; only L1/L2 run by default`)
  }
  const envVersions = parseEnvVersions()
  const jar = ensureJar(product, { rebuild: opts.rebuild })
  const orchestration = await import(pathToFileURL(orchestrationFile))
  const fn = orchestration[labName]
  if (typeof fn !== 'function') fail(`labs.mjs has no export for lab ${labName}`)

  const ctx = makeCtx({ product, lab, registry, envVersions, jar, opts })
  ctx.resetWorkDir()
  const startedAt = Date.now()
  let exitCode = 0

  try {
    log(`=== ${product} / ${labName} (${lab.level}): ${lab.description} ===`)
    await ctx.up()
    await ctx.waitForService()
    await fn(ctx)
    if (!ctx.compareWithCommittedSnapshot()) ctx.failures += 1
  } catch (err) {
    console.error(err)
    ctx.failures += 1
    exitCode = 1
  }

  if (ctx.failures > 0) {
    exitCode = 1
    await ctx.captureBrokerLogs().catch(() => {})
  }

  if (opts.keep) {
    log(`--keep: leaving compose project ${ctx.composeProject} running`)
  } else {
    await ctx.down()
  }

  const durationMs = Date.now() - startedAt
  if (opts.collect) {
    ctx.writeSnapshot({ exitCode, durationMs })
  } else if (!fs.existsSync(path.join(ROOT, 'outputs', product, `${labName}.snapshot`))) {
    ctx.writeSnapshot({ exitCode, durationMs })
    log('no committed snapshot existed; wrote a new one (review before committing)')
  }

  log(`=== ${product} / ${labName}: ${ctx.failures === 0 ? 'PASS' : 'FAIL'} (${durationMs}ms) ===`)
  return ctx.failures === 0
}

async function clean(product) {
  const { registry } = loadRegistry(product)
  const composeFile = path.join(ROOT, registry.compose)
  for (const lab of registry.labs) {
    const project = `hello-mq-${product}-${lab.name}`
    log(`cleaning compose project ${project}`)
    await spawnAsync(
      'docker',
      ['compose', '-p', project, '--env-file', path.join(ROOT, '.env.versions'), '-f', composeFile, 'down', '--volumes', '--remove-orphans', '--timeout', '10'],
      { echoStdout: false },
    )
  }
  fs.rmSync(path.join(ROOT, '.lab', product), { recursive: true, force: true })
  log('clean done (scoped to hello-mq-* projects only)')
}

function cmdList() {
  for (const product of listProducts()) {
    const { registry } = loadRegistry(product)
    console.log(`${product}:`)
    for (const lab of registry.labs) {
      console.log(`  ${lab.level}  ${lab.name.padEnd(16)} ${lab.description}`)
    }
  }
}

function cmdVerify() {
  const outputsDir = path.join(ROOT, 'outputs')
  if (!fs.existsSync(outputsDir)) fail('outputs/ not found')
  const files = []
  for (const product of fs.readdirSync(outputsDir)) {
    const dir = path.join(outputsDir, product)
    if (!fs.statSync(dir).isDirectory()) continue
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.snapshot')) files.push(path.join(dir, f))
    }
  }
  if (files.length === 0) fail('no snapshots found under outputs/')
  const required = ['status', 'product', 'lab', 'brokerVersion', 'image', 'client', 'capturedAt', 'durationMs', 'exitCode', 'assertions']
  let failures = 0
  for (const file of files) {
    const rel = path.relative(ROOT, file)
    const raw = fs.readFileSync(file, 'utf8')
    const snap = parseSnapshot(raw)
    for (const key of required) {
      if (snap.frontmatter[key] === undefined) {
        console.log(`[assert] ${rel}:missing-field=${key} FAIL`)
        failures += 1
      }
    }
    if (snap.frontmatter.status !== 'verified') {
      console.log(`[assert] ${rel}:status=${snap.frontmatter.status} FAIL (expected verified)`)
      failures += 1
    }
    if (/(:|-)latest($|[,@])/.test(String(snap.frontmatter.image)) || !String(snap.frontmatter.image).includes('@sha256:')) {
      console.log(`[assert] ${rel}:image-pinning FAIL`)
      failures += 1
    }
    if (normalizeOutput(snap.body) !== snap.body) {
      console.log(`[assert] ${rel}:normalization-idempotent FAIL`)
      failures += 1
    }
    if (failures === 0) console.log(`[assert] ${rel} PASS`)
  }
  if (failures > 0) process.exit(1)
  log(`verify OK: ${files.length} snapshot(s)`)
}

async function main() {
  const args = process.argv.slice(2)
  const opts = { keep: args.includes('--keep'), rebuild: args.includes('--rebuild'), collect: false }
  const positional = args.filter((a) => !a.startsWith('--'))

  if (positional[0] === 'list') return cmdList()
  if (positional[0] === 'verify') return cmdVerify()

  if (positional[0] === 'collect') {
    const product = positional[1] || fail('collect requires a product')
    const { registry } = loadRegistry(product)
    let ok = true
    for (const lab of registry.labs) {
      const passed = await runLab(product, lab.name, { ...opts, collect: true })
      ok = ok && passed
    }
    process.exit(ok ? 0 : 1)
  }

  const product = positional[0] || fail('missing product; try: node scripts/lab.js list')
  const labName = positional[1] || fail('missing lab name; try: node scripts/lab.js list')
  const { registry } = loadRegistry(product)

  if (labName === 'clean') return clean(product)

  if (labName === 'all') {
    let ok = true
    for (const lab of registry.labs) {
      const passed = await runLab(product, lab.name, opts)
      ok = ok && passed
    }
    process.exit(ok ? 0 : 1)
  }

  const passed = await runLab(product, labName, opts)
  process.exit(passed ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
