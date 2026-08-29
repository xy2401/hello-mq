#!/usr/bin/env node
// hello-mq 静态门禁（规格 §13.2 的 Phase 1 落地子集）。
// 由 npm run check:project 调用；失败以退出码 1 结束并列出全部问题。

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import YAML from 'yaml'
import { nav, sidebar } from '../docs/.vitepress/nav.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = path.join(ROOT, 'docs')

const failures = []
function ok(msg) {
  console.log(`[check] ${msg}`)
}
function fail(msg) {
  failures.push(msg)
  console.error(`[check] FAIL: ${msg}`)
}

function walk(dir, filter, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', '.vitepress', 'dist', 'target', '.git', '.lab'].includes(entry.name)) continue
      walk(full, filter, out)
    } else if (filter(full)) {
      out.push(full)
    }
  }
  return out
}

function linkToFile(baseDir, link) {
  if (link.startsWith('http://') || link.startsWith('https://') || link.startsWith('#') || link.startsWith('mailto:')) {
    return null
  }
  const clean = link.split(/[?#]/)[0]
  if (!clean) return null
  if (clean.startsWith('/')) {
    const p = path.join(DOCS, clean)
    if (clean.endsWith('/')) return path.join(p, 'index.md')
    if (fs.existsSync(path.join(DOCS, `${clean}.md`))) return path.join(DOCS, `${clean}.md`)
    if (fs.existsSync(path.join(DOCS, clean, 'index.md'))) return path.join(DOCS, clean, 'index.md')
    return fs.existsSync(p) ? p : path.join(DOCS, `${clean}.md`)
  }
  const relative = path.resolve(baseDir, clean)
  if (fs.existsSync(relative)) return relative
  if (fs.existsSync(`${relative}.md`)) return `${relative}.md`
  if (fs.existsSync(path.join(relative, 'index.md'))) return path.join(relative, 'index.md')
  return relative
}

function checkMarkdownLinks() {
  const mdFiles = [path.join(ROOT, 'README.md'), ...walk(DOCS, (f) => f.endsWith('.md'))]
  let checked = 0
  for (const file of mdFiles) {
    const baseDir = path.dirname(file)
    const text = fs.readFileSync(file, 'utf8')
    const linkRe = /\[[^\]]*\]\(([^)\s]+)\)/g
    for (const m of text.matchAll(linkRe)) {
      const target = linkToFile(baseDir, m[1])
      if (!target) continue
      checked += 1
      if (!fs.existsSync(target)) {
        fail(`broken link in ${path.relative(ROOT, file)}: ${m[1]}`)
      }
    }
  }
  ok(`markdown links checked (${checked})`)
}

function collectNavLinks() {
  const links = []
  const visit = (items) => {
    for (const item of items ?? []) {
      if (item.link) links.push(item.link)
      if (item.items) visit(item.items)
    }
  }
  visit(nav)
  for (const section of Object.values(sidebar)) visit(section)
  return links
}

function checkNavLinks() {
  for (const link of collectNavLinks()) {
    const target = linkToFile(DOCS, link)
    if (!target || !fs.existsSync(target)) fail(`nav/sidebar link missing: ${link}`)
  }
  ok('nav/sidebar links exist')
}

function checkEnvVersions() {
  const file = path.join(ROOT, '.env.versions')
  const text = fs.readFileSync(file, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 0) continue
    const [key, value] = [trimmed.slice(0, idx), trimmed.slice(idx + 1)]
    if (!key.endsWith('_IMAGE')) continue
    if (/(^|:|-)latest($|[,@])/.test(value) || /:edge|:nightly/.test(value)) {
      fail(`.env.versions floating tag: ${key}`)
    }
    if (!value.includes('@sha256:')) {
      fail(`.env.versions missing digest: ${key}`)
    }
  }
  ok('.env.versions pinned with tag+digest')
}

function checkComposeFiles() {
  const files = walk(path.join(ROOT, 'demos'), (f) => f.endsWith('docker-compose.yml'))
  const playgroundManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'demos', 'playground-scenarios.json'), 'utf8'))
  const playgroundComposeFiles = new Set(playgroundManifest.map((entry) => path.join(ROOT, 'demos', entry.product, entry.id, 'docker-compose.yml')))
  if (files.length === 0) fail('no demos/*/*/docker-compose.yml found')
  for (const file of files) {
    let doc
    try {
      doc = YAML.parse(fs.readFileSync(file, 'utf8'))
    } catch (err) {
      fail(`compose file not parseable: ${path.relative(ROOT, file)} (${err.message})`)
      continue
    }
    const services = Object.keys(doc.services ?? {})
    if (new Set(services).size !== services.length) fail(`duplicate service names in ${file}`)
    for (const [name, service] of Object.entries(doc.services ?? {})) {
      for (const port of service.ports ?? []) {
        const p = String(port)
        if (!p.startsWith('127.0.0.1')) {
          fail(`service ${name} in ${path.relative(ROOT, file)} exposes non-localhost port: ${p}`)
        }
        if (playgroundComposeFiles.has(file)) fail(`parallel playground scenario publishes unnecessary host port: ${path.relative(ROOT, file)} (${p})`)
      }
      if (typeof service.image === 'string' && /(^|:)latest($|@)/.test(service.image)) {
        fail(`service ${name} uses latest image`)
      }
    }
  }
  ok(`compose files parse; playground scenarios publish no host ports (${files.length})`)
}

function checkContractsAndFixtures() {
  const ajv = new Ajv({ allErrors: true })
  addFormats(ajv)
  const schemaPath = path.join(ROOT, 'demos', 'shared', 'contracts', 'order-created.v1.schema.json')
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'))
  const validate = ajv.compile(schema)

  const fixturesDir = path.join(ROOT, 'demos', 'shared', 'fixtures')
  const orderFixtures = fs.readdirSync(fixturesDir).filter((f) => f.startsWith('order-') && f.endsWith('.json'))
  if (orderFixtures.length === 0) fail('no order fixtures found')
  for (const f of orderFixtures) {
    const data = JSON.parse(fs.readFileSync(path.join(fixturesDir, f), 'utf8'))
    if (!validate(data)) fail(`fixture ${f} violates schema: ${ajv.errorsText(validate.errors)}`)
  }
  const poison = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'poison-message.json'), 'utf8'))
  if (validate(poison)) fail('poison-message.json unexpectedly passes schema (it must stay business-invalid)')
  ok(`contracts: schema compiles, ${orderFixtures.length} fixtures valid, poison fixture intentionally invalid`)
}

function checkForbiddenFiles() {
  const res = spawnSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
  if (res.status !== 0) {
    ok('git ls-files unavailable; skipped forbidden-file check')
    return
  }
  const forbidden = /\.(class|jar|db)$/
  for (const f of res.stdout.split('\n')) {
    if (!f) continue
    if (forbidden.test(f)) fail(`forbidden file tracked by git: ${f}`)
    if (f === '.env') fail('.env must never be committed')
  }
  ok('no forbidden build artifacts/secrets tracked')
}

function checkBrokerTemplates() {
  const requiredPages = ['index.md', 'quick-start.md', 'concepts.md', 'routing.md', 'reliability.md', 'storage-ha.md', 'operations.md', 'pitfalls.md']
  const brokersDir = path.join(DOCS, 'brokers')
  if (!fs.existsSync(brokersDir)) return
  for (const product of fs.readdirSync(brokersDir)) {
    const dir = path.join(brokersDir, product)
    if (!fs.statSync(dir).isDirectory()) continue
    for (const page of requiredPages) {
      if (!fs.existsSync(path.join(dir, page))) fail(`brokers/${product}/ missing template page: ${page}`)
    }
  }
  ok('broker volume template pages present')
}

function checkSourcesCheckedAt() {
  const file = path.join(DOCS, 'reference', 'sources.md')
  const text = fs.readFileSync(file, 'utf8')
  const rows = text.split('\n').filter((l) => l.startsWith('|') && l.includes('http'))
  if (rows.length === 0) fail('sources.md has no entries')
  for (const row of rows) {
    if (!/checkedAt|\d{4}-\d{2}-\d{2}/.test(row)) fail(`sources.md entry missing checkedAt date: ${row.slice(0, 60)}...`)
  }
  ok(`sources.md entries carry checkedAt dates (${rows.length})`)
}

function checkScriptSyntax() {
  const scripts = walk(path.join(ROOT, 'scripts'), (f) => f.endsWith('.js'))
  for (const s of scripts) {
    const res = spawnSync('node', ['--check', s], { encoding: 'utf8' })
    if (res.status !== 0) fail(`script syntax error: ${path.relative(ROOT, s)}\n${res.stderr}`)
  }
  ok(`script syntax OK (${scripts.length})`)
}

function checkDemoBuildEntry() {
  const common = fs.readFileSync(path.join(ROOT, 'demos', 'shared', 'run-common.sh'), 'utf8')
  if (!common.includes('mvn -B -f "$LAB_DIR/../../pom.xml"')) {
    fail('ensure_jar must resolve demos/pom.xml from LAB_DIR instead of the caller working directory')
  }
  if (/cd\s+"\$LAB_DIR\/\.\.\/\.\."[^\n]*mvn[^\n]*-f\s+demos\/pom\.xml/.test(common)) {
    fail('ensure_jar resolves demos/demos/pom.xml after entering demos/')
  }
  ok('demo Maven entry resolves from LAB_DIR')
}

function checkCrashRecoveryPhases() {
  for (const product of ['rabbitmq', 'redis-streams']) {
    const file = path.join(ROOT, 'demos', product, 'consumer-crash', 'run.sh')
    const text = fs.readFileSync(file, 'utf8')
    if (/^compose up -d\s*$/m.test(text)) {
      fail(`${product}/consumer-crash must not restart all services during recovery`)
    }
    if (!text.includes('compose up -d --no-deps consumer-run2')) {
      fail(`${product}/consumer-crash recovery must start only consumer-run2`)
    }
    if (!text.includes('compose up -d --no-deps inspect-db')) {
      fail(`${product}/consumer-crash inspection must not restart consumer-run1`)
    }
  }
  ok('crash recovery phases do not restart the crashed consumer')
}

function checkLabTimeouts() {
  const common = fs.readFileSync(path.join(ROOT, 'demos', 'shared', 'run-common.sh'), 'utf8')
  const collector = fs.readFileSync(path.join(ROOT, 'scripts', 'collect-playground.js'), 'utf8')
  const smoke = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'smoke-labs.yml'), 'utf8')
  if (!common.includes('HELLO_MQ_COMPOSE_TIMEOUT_SECONDS') || !common.includes('timeout --signal=TERM --kill-after=30s')) {
    fail('run-common.sh must bound every Docker Compose command')
  }
  if (!collector.includes('HELLO_MQ_SCENARIO_TIMEOUT_SECONDS') || !collector.includes('captureTimeoutDiagnostics')) {
    fail('playground collector must enforce a scenario timeout and preserve diagnostics')
  }
  if (!smoke.includes('timeout --signal=TERM --kill-after=45s 660s bash')) {
    fail('smoke workflow must bound each lab independently')
  }
  if (!common.includes('wait_healthy()') || !common.includes('Waiting for %s health')) {
    fail('run-common.sh must report bounded healthcheck progress for long-running services')
  }
  for (const script of walk(path.join(ROOT, 'demos'), (file) => file.endsWith('run.sh'))) {
    const text = fs.readFileSync(script, 'utf8')
    if (/^compose wait (rabbitmq|proxy)(?:\s|$)/m.test(text)) {
      fail(`${path.relative(ROOT, script)} waits for a long-running service to exit; use wait_healthy`)
    }
  }
  ok('lab, Compose and collector timeouts are enforced')
}

checkMarkdownLinks()
checkNavLinks()
checkEnvVersions()
checkComposeFiles()
checkContractsAndFixtures()
checkForbiddenFiles()
checkBrokerTemplates()
checkSourcesCheckedAt()
checkScriptSyntax()
checkDemoBuildEntry()
checkCrashRecoveryPhases()
checkLabTimeouts()

if (failures.length > 0) {
  console.error(`\n[check] ${failures.length} problem(s) found`)
  process.exit(1)
}
console.log('\n[check] all checks passed')
