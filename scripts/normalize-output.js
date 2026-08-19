// 快照归一化与快照文件读写（规格 §9.5）。
// 归一化必须幂等：normalizeOutput(normalizeOutput(x)) === normalizeOutput(x)。

const ANSI_RE = /\u001b\[[0-9;]*m/g
const ISO_TS_RE = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g
const CONTAINER_ID_RE = /\b[0-9a-f]{12}\b/g
const ABS_PATH_RE = /(\/[\w.-]+){2,}/g

export function normalizeOutput(text) {
  let out = text.replace(ANSI_RE, '')

  // 稳定的动态 ID 占位符：按首次出现顺序编号，保证可重复 diff。
  const idMaps = { messageId: new Map(), traceId: new Map() }
  out = out.replace(/(messageId=|traceId=)([0-9A-Za-z-]+)/g, (whole, key, value) => {
    const field = key.slice(0, -1)
    if (value.startsWith(`${field === 'messageId' ? 'mid' : 'trace'}-`)) return whole
    const map = idMaps[field]
    if (!map.has(value)) map.set(value, `${field === 'messageId' ? 'mid' : 'trace'}-${map.size + 1}`)
    return `${key}${map.get(value)}`
  })

  out = out
    .replace(ISO_TS_RE, '<ts>')
    .replace(CONTAINER_ID_RE, '<cid>')
    .replace(ABS_PATH_RE, (m) => (m.includes('hello-mq') ? '<repo>' : m))
    .replace(/\bdurationMs=\d+/g, 'durationMs=<ms>')
  return out
}

export function renderSnapshot({ frontmatter, body }) {
  const lines = ['---']
  for (const [key, value] of Object.entries(frontmatter)) {
    if (key === 'assertions') {
      lines.push('assertions:')
      for (const [name, v] of Object.entries(value)) {
        lines.push(`  ${name}: ${typeof v === 'number' ? v : JSON.stringify(v)}`)
      }
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`)
    } else {
      lines.push(`${key}: ${JSON.stringify(value)}`)
    }
  }
  lines.push('---')
  return `${lines.join('\n')}\n${body}\n`
}

export function parseSnapshot(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!m) throw new Error('snapshot missing frontmatter')
  const frontmatter = {}
  const assertions = {}
  let inAssertions = false
  for (const line of m[1].split('\n')) {
    if (!line.trim()) continue
    if (/^assertions:\s*$/.test(line)) {
      inAssertions = true
      frontmatter.assertions = assertions
      continue
    }
    if (inAssertions && /^\s{2}\S/.test(line)) {
      const kv = line.trim().match(/^(\S+):\s*(.*)$/)
      if (kv) {
        const v = kv[2]
        assertions[kv[1]] = /^-?\d+$/.test(v) ? Number(v) : JSON.parse(v)
      }
      continue
    }
    inAssertions = false
    const kv = line.match(/^(\S+):\s*(.*)$/)
    if (!kv) continue
    const v = kv[2]
    if (/^-?\d+$/.test(v)) frontmatter[kv[1]] = Number(v)
    else {
      try {
        frontmatter[kv[1]] = JSON.parse(v)
      } catch {
        frontmatter[kv[1]] = v
      }
    }
  }
  return { frontmatter, body: m[2] }
}

// CLI: node scripts/normalize-output.js <file>  → 输出归一化内容
if (process.argv[1] && process.argv[1].endsWith('normalize-output.js') && process.argv[2]) {
  const fs = await import('node:fs')
  process.stdout.write(normalizeOutput(fs.readFileSync(process.argv[2], 'utf8')))
}
