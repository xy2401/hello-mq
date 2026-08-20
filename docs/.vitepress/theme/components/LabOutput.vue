<script setup lang="ts">
import { data } from '../data/lab-outputs.data'

const props = defineProps<{ product: string; lab: string }>()
const logs = data[`${props.product}/${props.lab}`] ?? {}
const roles = Object.keys(logs)
const reproCommand = `bash demos/${props.product}/${props.lab}/run.sh`

function copyCommand() {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(reproCommand)
  }
}
</script>

<template>
  <div class="lab-output">
    <div class="lab-output__head">
      <strong>{{ product }} / {{ lab }}</strong>
      <code class="lab-output__mono">{{ reproCommand }}</code>
      <button class="lab-output__copy" type="button" title="复制复现命令" @click="copyCommand">复制</button>
    </div>
    <template v-if="roles.length > 0">
      <details v-for="role in roles" :key="role" :open="role === 'assert'">
        <summary>{{ role }}.out.txt</summary>
        <pre class="lab-output__log">{{ logs[role] }}</pre>
      </details>
    </template>
    <p v-else class="lab-output__empty">尚未收集输出日志：运行 <code>{{ reproCommand }}</code> 后生成。</p>
  </div>
</template>

<style scoped>
.lab-output {
  margin: 16px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}
.lab-output__head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
  background: var(--vp-c-bg-soft);
}
.lab-output__mono {
  font-size: 12px;
}
.lab-output__copy {
  margin-left: auto;
  font-size: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  padding: 2px 8px;
}
.lab-output summary {
  padding: 6px 12px;
  cursor: pointer;
}
.lab-output__log {
  margin: 0;
  padding: 12px;
  max-height: 420px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.6;
  background: var(--vp-code-block-bg);
  color: var(--vp-code-block-text);
}
.lab-output__empty {
  padding: 12px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
</style>
