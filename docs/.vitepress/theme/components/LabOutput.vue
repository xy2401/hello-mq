<script setup lang="ts">
import { data } from '../data/lab-outputs.data'

const props = defineProps<{ product: string; lab: string }>()
const snapshot = data[`${props.product}/${props.lab}`]
const reproCommand = `npm run lab -- ${props.product} ${props.lab}`

function copyCommand() {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(reproCommand)
  }
}
</script>

<template>
  <div class="lab-output">
    <template v-if="snapshot">
      <div class="lab-output__head">
        <span class="lab-output__badge" :class="`lab-output__badge--${snapshot.status}`">
          {{ snapshot.status }}
        </span>
        <strong>{{ snapshot.product }} / {{ snapshot.lab }}</strong>
        <span class="lab-output__meta">broker {{ snapshot.brokerVersion }} · {{ snapshot.client }}</span>
      </div>
      <table class="lab-output__table">
        <tbody>
          <tr>
            <td>镜像</td>
            <td class="lab-output__mono">{{ snapshot.image }}</td>
          </tr>
          <tr>
            <td>捕获时间</td>
            <td>{{ snapshot.capturedAt }}</td>
          </tr>
          <tr>
            <td>耗时 / 退出码</td>
            <td>{{ snapshot.durationMs }} ms / exit {{ snapshot.exitCode }}</td>
          </tr>
        </tbody>
      </table>
      <details open>
        <summary>断言</summary>
        <table class="lab-output__table">
          <tbody>
            <tr v-for="(value, name) in snapshot.assertions" :key="name">
              <td>{{ name }}</td>
              <td>{{ value }}</td>
            </tr>
          </tbody>
        </table>
      </details>
      <details>
        <summary>归一化日志</summary>
        <pre>{{ snapshot.body }}</pre>
      </details>
      <div class="lab-output__actions">
        <code>{{ reproCommand }}</code>
        <button type="button" @click="copyCommand">复制命令</button>
      </div>
    </template>
    <template v-else>
      <div class="lab-output__missing">
        快照待生成：运行 <code>{{ reproCommand }}</code> 后提交 outputs/{{ props.product }}/{{ props.lab }}.snapshot
      </div>
    </template>
  </div>
</template>

<style scoped>
.lab-output {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 16px 0;
  background: var(--vp-c-bg-soft);
}
.lab-output__head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.lab-output__badge {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}
.lab-output__badge--verified {
  background: rgba(16, 185, 129, 0.16);
  color: #059669;
}
.lab-output__badge--failed {
  background: rgba(239, 68, 68, 0.16);
  color: #dc2626;
}
.lab-output__meta {
  color: var(--vp-c-text-2);
  font-size: 13px;
}
.lab-output__table {
  width: 100%;
  font-size: 13px;
  margin: 8px 0;
}
.lab-output__table td {
  padding: 4px 8px;
  border: 1px solid var(--vp-c-divider);
}
.lab-output__mono {
  font-family: var(--vp-font-family-mono);
  word-break: break-all;
}
.lab-output__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.lab-output__actions button {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  border-radius: 6px;
  padding: 2px 10px;
  cursor: pointer;
}
.lab-output__missing {
  color: var(--vp-c-text-2);
}
</style>
