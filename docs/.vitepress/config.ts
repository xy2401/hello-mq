import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
// @ts-ignore -- 纯 JS 模块，config 与 check-project 共享同一数据源
import { nav, sidebar } from './nav.mjs'

const base = defineConfig({
  lang: 'zh-CN',
  title: 'hello-mq',
  description:
    '消息队列、事件流平台与可靠消息模式知识库：统一语义骨架、可运行实验与横向选型',
  cleanUrls: true,
  lastUpdated: true,
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }]],
  themeConfig: {
    logo: '/logo.svg',
    nav,
    sidebar,
    search: { provider: 'local' },
    outline: { level: [2, 3], label: '本页目录' },
    lastUpdated: { text: '最后更新' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    socialLinks: [],
    footer: {
      message: '以统一实验验证消息系统语义边界',
      copyright: 'MIT License',
    },
  },
  mermaid: {
    theme: 'neutral',
  },
})

export default withMermaid(base)
