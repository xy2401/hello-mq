<script setup lang="ts">
// 静态数据驱动的能力矩阵（规格 §10.2 与 §8.2）：五级标记 + 脚注 + 证据链接。
type Cell = { level: 'native' | 'composed' | 'framework' | 'business' | 'none'; note?: string; link?: string }
type Row = { capability: string; cells: Cell[] }

defineProps<{ columns: string[]; rows: Row[]; footnotes?: string[] }>()

const LEVELS: Record<Cell['level'], { label: string; className: string }> = {
  native: { label: '原生', className: 'native' },
  composed: { label: '组合配置', className: 'composed' },
  framework: { label: '客户端框架', className: 'framework' },
  business: { label: '业务实现', className: 'business' },
  none: { label: '不适用', className: 'none' },
}
</script>

<template>
  <div class="capability-matrix">
    <table>
      <thead>
        <tr>
          <th>能力</th>
          <th v-for="col in columns" :key="col">{{ col }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.capability">
          <td class="capability-matrix__capability">{{ row.capability }}</td>
          <td v-for="(cell, i) in row.cells" :key="i">
            <span class="capability-matrix__level" :class="`capability-matrix__level--${LEVELS[cell.level].className}`">
              {{ LEVELS[cell.level].label }}
            </span>
            <div v-if="cell.note" class="capability-matrix__note">
              {{ cell.note }}
              <a v-if="cell.link" :href="cell.link">证据</a>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
    <ul v-if="footnotes?.length" class="capability-matrix__footnotes">
      <li v-for="(fn, i) in footnotes" :key="i">{{ fn }}</li>
    </ul>
  </div>
</template>

<style scoped>
.capability-matrix {
  margin: 16px 0;
}
.capability-matrix table {
  width: 100%;
  font-size: 13px;
}
.capability-matrix td,
.capability-matrix th {
  border: 1px solid var(--vp-c-divider);
  padding: 6px 8px;
  vertical-align: top;
}
.capability-matrix__capability {
  font-weight: 600;
}
.capability-matrix__level {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 999px;
}
.capability-matrix__level--native {
  background: rgba(16, 185, 129, 0.16);
  color: #059669;
}
.capability-matrix__level--composed {
  background: rgba(59, 130, 246, 0.16);
  color: #2563eb;
}
.capability-matrix__level--framework {
  background: rgba(245, 158, 11, 0.16);
  color: #d97706;
}
.capability-matrix__level--business {
  background: rgba(239, 68, 68, 0.16);
  color: #dc2626;
}
.capability-matrix__level--none {
  background: rgba(107, 114, 128, 0.16);
  color: #6b7280;
}
.capability-matrix__note {
  margin-top: 4px;
  color: var(--vp-c-text-2);
}
.capability-matrix__footnotes {
  margin-top: 8px;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
</style>
