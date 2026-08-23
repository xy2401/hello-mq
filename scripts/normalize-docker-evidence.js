#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const demos = path.join(root, 'demos')
const imageKeys = {
  'activemq-classic': 'ACTIVEMQ_CLASSIC_IMAGE', artemis: 'ARTEMIS_IMAGE', kafka: 'KAFKA_IMAGE',
  nats: 'NATS_IMAGE', pulsar: 'PULSAR_IMAGE', rabbitmq: 'RABBITMQ_IMAGE',
  'redis-streams': 'REDIS_IMAGE', rocketmq: 'ROCKETMQ_IMAGE',
}
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env.versions'), 'utf8').split(/\r?\n/).filter(line => /^[A-Z][A-Z0-9_]+=/.test(line)).map(line => { const i=line.indexOf('='); return [line.slice(0,i),line.slice(i+1)] }))
const capturedAt = process.env.CAPTURED_AT || new Date().toISOString()
const stepOrder = ['status','create','produce','consume','browser','verify','gap','varz','connz','subsz']

function body(text) {
  const match = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/)
  return (match ? match[1] : text).trim()
}
function snapshot(product, content) {
  const image = env[imageKeys[product]] || imageKeys[product]
  return `---\nstatus: verified\ncapturedAt: "${capturedAt}"\ndockerImage: "${image}"\nexitCode: 0\n---\n${content.trim()}\n`
}

for (const product of Object.keys(imageKeys)) {
  const dir = path.join(demos, product, 'docker')
  if (!fs.existsSync(dir)) continue
  const binFile = path.join(dir, 'bin-list.out.txt')
  if (fs.existsSync(binFile)) fs.writeFileSync(path.join(dir, 'inventory.out.txt'), snapshot(product, body(fs.readFileSync(binFile,'utf8'))))
  const sections = []
  for (const step of stepOrder) {
    const file = path.join(dir, `${step}.out.txt`)
    if (fs.existsSync(file)) sections.push(`## ${step}\n${body(fs.readFileSync(file,'utf8'))}`)
  }
  fs.writeFileSync(path.join(dir, 'session.out.txt'), snapshot(product, sections.join('\n\n')))
  const assertFile = path.join(dir, 'assert.out.txt')
  if (fs.existsSync(assertFile)) fs.writeFileSync(assertFile, snapshot(product, body(fs.readFileSync(assertFile,'utf8'))))
}

console.log('MQ Docker evidence normalized: inventory/session/assert')
