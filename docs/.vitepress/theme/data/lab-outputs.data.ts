// VitePress data loader：构建期读取 outputs/** 快照，供 LabOutput 组件渲染。
// outputs 为空时返回空对象，保证 Phase 0 的 docs:build 可通过。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

function parseSnapshotFrontmatter(raw: string): Record<string, unknown> {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) return {}
  const fm: Record<string, unknown> = {}
  const assertions: Record<string, unknown> = {}
  let inAssertions = false
  for (const line of m[1].split('\n')) {
    if (/^assertions:\s*$/.test(line)) {
      inAssertions = true
      continue
    }
    if (inAssertions && /^\s{2}\S/.test(line)) {
      const kv = line.trim().match(/^(\S+):\s*(.*)$/)
      if (kv) assertions[kv[1]] = /^-?\d+$/.test(kv[2]) ? Number(kv[2]) : safeJson(kv[2])
      continue
    }
    inAssertions = false
    const kv = line.match(/^(\S+):\s*(.*)$/)
    if (!kv) continue
    fm[kv[1]] = /^-?\d+$/.test(kv[2]) ? Number(kv[2]) : safeJson(kv[2])
  }
  fm.assertions = assertions
  fm.body = m[2]
  return fm
}

function safeJson(v: string): unknown {
  try {
    return JSON.parse(v)
  } catch {
    return v
  }
}

export interface LabSnapshot {
  status: string
  product: string
  lab: string
  brokerVersion: string
  image: string
  client: string
  capturedAt: string
  durationMs: number
  exitCode: number
  assertions: Record<string, number | string>
  body: string
}

declare const data: Record<string, LabSnapshot>
export { data }

export default {
  load(): Record<string, LabSnapshot> {
    const outputsDir = path.join(ROOT, 'outputs')
    const result: Record<string, LabSnapshot> = {}
    if (!fs.existsSync(outputsDir)) return result
    for (const product of fs.readdirSync(outputsDir)) {
      const dir = path.join(outputsDir, product)
      if (!fs.statSync(dir).isDirectory()) continue
      for (const file of fs.readdirSync(dir)) {
        if (!file.endsWith('.snapshot')) continue
        const raw = fs.readFileSync(path.join(dir, file), 'utf8')
        const fm = parseSnapshotFrontmatter(raw)
        if (fm.product && fm.lab) {
          result[`${fm.product}/${fm.lab}`] = fm as unknown as LabSnapshot
        }
      }
    }
    return result
  },
}
