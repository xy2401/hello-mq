<script setup lang="ts">
// 静态数据驱动的配置对照组件（规格 §10.2）：Before/After、风险标记、版本适用范围。
type ConfigPane = { product: string; title?: string; code: string; risk?: 'high' | 'safe' }

defineProps<{ title?: string; panes: ConfigPane[]; note?: string; appliesTo?: string }>()

const RISK: Record<'high' | 'safe', string> = { high: '⚠️ 风险', safe: '✅ 推荐' }
</script>

<template>
  <div class="config-diff">
    <div v-if="title" class="config-diff__title">{{ title }}</div>
    <div class="config-diff__grid">
      <div v-for="pane in panes" :key="pane.product" class="config-diff__pane" :class="pane.risk ? `config-diff__pane--${pane.risk}` : ''">
        <div class="config-diff__pane-head">
          <strong>{{ pane.product }}</strong>
          <span v-if="pane.title">{{ pane.title }}</span>
          <span v-if="pane.risk" class="config-diff__risk" :class="`config-diff__risk--${pane.risk}`">{{ RISK[pane.risk] }}</span>
        </div>
        <pre><code>{{ pane.code }}</code></pre>
      </div>
    </div>
    <p v-if="note" class="config-diff__note">{{ note }}</p>
    <p v-if="appliesTo" class="config-diff__applies">版本适用：{{ appliesTo }}</p>
  </div>
</template>

<style scoped>
.config-diff {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 16px 0;
  background: var(--vp-c-bg-soft);
}
.config-diff__title {
  font-weight: 600;
  margin-bottom: 8px;
}
.config-diff__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 12px;
}
.config-diff__pane {
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  overflow: hidden;
}
.config-diff__pane-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  font-size: 13px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.config-diff__pane-head span {
  color: var(--vp-c-text-2);
  font-weight: 400;
}
.config-diff__pane pre {
  margin: 0;
  padding: 10px;
  font-size: 12px;
  overflow-x: auto;
}
.config-diff__note {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.config-diff__applies {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--vp-c-text-3);
}
.config-diff__risk {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 999px;
}
.config-diff__risk--high {
  background: rgba(239, 68, 68, 0.16);
  color: #dc2626;
}
.config-diff__risk--safe {
  background: rgba(16, 185, 129, 0.16);
  color: #059669;
}
.config-diff__pane--high {
  border-color: rgba(239, 68, 68, 0.5);
}
.config-diff__pane--safe {
  border-color: rgba(16, 185, 129, 0.5);
}
</style>
