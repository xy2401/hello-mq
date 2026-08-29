import fs from 'node:fs'
import path from 'node:path'
import type { ReplayCatalogEntry, ReplayScenario } from './replay'
import { normalizeEvidenceText, readEvidenceText, REPOSITORY_ROOT } from './evidence-files'

declare const data: ReplayCatalogEntry[]
export { data }

export default {
  watch: ['../../../../demos/playground-scenarios.json', '../../../../demos/*/*/replay.json'],
  load(): ReplayCatalogEntry[] {
    const manifestFile = path.join(REPOSITORY_ROOT, 'demos', 'playground-scenarios.json')
    if (!fs.existsSync(manifestFile)) return []
    const manifest = JSON.parse(readEvidenceText(manifestFile)) as ReplayCatalogEntry[]

    return manifest.map((entry) => {
      const replayFile = path.join(REPOSITORY_ROOT, 'demos', entry.product, entry.id, 'replay.json')
      if (!fs.existsSync(replayFile)) return { ...entry, evidenceStatus: 'pending' }
      try {
        const scenario = JSON.parse(normalizeEvidenceText(fs.readFileSync(replayFile, 'utf8'))) as ReplayScenario
        return { ...entry, evidenceStatus: scenario.evidenceStatus, scenario }
      } catch (error) {
        return {
          ...entry,
          evidenceStatus: 'failed',
          problem: error instanceof Error ? error.message : String(error),
        }
      }
    })
  },
}
