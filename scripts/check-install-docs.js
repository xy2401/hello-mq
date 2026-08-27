import fs from 'node:fs'
import path from 'node:path'

const products = ['activemq-classic', 'artemis', 'kafka', 'nats', 'pulsar', 'rabbitmq', 'redis-streams', 'rocketmq']
const root = process.cwd()
const sidebar = fs.readFileSync(path.join(root, 'docs/.vitepress/nav.mjs'), 'utf8')
const failures = []
const contents = new Map()

function requireMatch(condition, message) {
  if (!condition) failures.push(message)
}

for (const product of products) {
  const relative = `docs/products/${product}/install.md`
  const file = path.join(root, relative)
  requireMatch(fs.existsSync(file), `${relative}: 文件不存在`)
  if (!fs.existsSync(file)) continue
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  contents.set(product, text)
  requireMatch(text.length >= 900, `${relative}: 内容过短，疑似占位页`)
  requireMatch(/^# .+安装与切换/m.test(text), `${relative}: 缺少安装页标题`)
  requireMatch(/https:\/\//.test(text) && /官方/.test(text), `${relative}: 缺少官方 HTTPS 来源`)
  requireMatch(/^## 安装验证$/m.test(text), `${relative}: 缺少安装验证`)
  requireMatch(/^## Docker$/m.test(text), `${relative}: 缺少 Docker 示例或不适用说明`)
  requireMatch(/^## 版本切换$/m.test(text), `${relative}: 缺少版本切换说明`)
  requireMatch(text.includes('资料核对日期：2026-08-27。'), `${relative}: 核对日期不正确`)
  requireMatch(!/(TODO|TBD|待补充|<版本>|<候选>|<组件>|<version>|<name>|<path>)/i.test(text), `${relative}: 存在未替换占位符`)
  requireMatch(!/<script\b|<[A-Z][A-Za-z]+\b/.test(text), `${relative}: 不应嵌入动态组件`)
  requireMatch(!/docker run[^\n]*:(latest|edge|nightly)(?:\s|$)/i.test(text), `${relative}: Docker 示例使用浮动标签`)
  requireMatch(!/@latest\b/i.test(text), `${relative}: 安装命令使用浮动 @latest`)
}

requireMatch(sidebar.includes("{ text: '安装与切换', link: `${base}/install` }"), '消息产品侧栏未引用安装页')
requireMatch(new Set([...contents.values()]).size === contents.size, '存在内容完全相同的安装页')
if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`Install docs check passed: ${products.length} products`)
