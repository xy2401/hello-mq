import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadManifest, normalizeScenario, ROOT } from './playground-evidence-lib.js'

export function normalizeSelected(filter = {}) {
  const selected = loadManifest().filter((entry) =>
    (!filter.product || entry.product === filter.product)
    && (!filter.scenario || `${entry.product}/${entry.id}` === filter.scenario),
  )
  if (selected.length === 0) throw new Error('没有匹配的 playground 场景')
  for (const entry of selected) {
    const replay = normalizeScenario(entry)
    const target = path.join(ROOT, 'demos', entry.product, entry.id, 'replay.json')
    fs.writeFileSync(target, `${JSON.stringify(replay, null, 2)}\n`, 'utf8')
    console.log(`${replay.evidenceStatus === 'verified' ? 'VERIFIED' : 'FAILED'} ${entry.product}/${entry.id}`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const productAt = process.argv.indexOf('--product')
  const scenarioAt = process.argv.indexOf('--scenario')
  normalizeSelected({
    product: productAt >= 0 ? process.argv[productAt + 1] : undefined,
    scenario: scenarioAt >= 0 ? process.argv[scenarioAt + 1] : undefined,
  })
}
