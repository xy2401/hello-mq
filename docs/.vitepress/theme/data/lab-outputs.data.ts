// VitePress data loader：构建期读取 demos/<产品>/<实验>/*.out.txt 日志，供 LabOutput 组件按角色分块渲染。
// 尚无日志时该实验键不存在，组件显示降级文案，保证 docs:build 可通过。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

declare const data: Record<string, Record<string, string>>
export { data }

export default {
  load(): Record<string, Record<string, string>> {
    const demosDir = path.join(ROOT, 'demos')
    const result: Record<string, Record<string, string>> = {}
    if (!fs.existsSync(demosDir)) return result
    for (const product of fs.readdirSync(demosDir)) {
      const productDir = path.join(demosDir, product)
      if (!fs.statSync(productDir).isDirectory()) continue
      for (const lab of fs.readdirSync(productDir)) {
        const labDir = path.join(productDir, lab)
        if (!fs.statSync(labDir).isDirectory()) continue
        const logs: Record<string, string> = {}
        for (const file of fs.readdirSync(labDir).sort()) {
          if (!file.endsWith('.out.txt')) continue
          logs[file.slice(0, -'.out.txt'.length)] = fs.readFileSync(path.join(labDir, file), 'utf8')
        }
        if (Object.keys(logs).length > 0) result[`${product}/${lab}`] = logs
      }
    }
    return result
  },
}
