<script setup lang="ts">
// 交互式拓扑示意图（规格 §10.2）：切换模式、高亮消息流；静态数据驱动，不连接真实 Broker。
import { computed, onUnmounted, ref } from 'vue'

type TopoNode = { id: string; label: string; kind?: 'producer' | 'broker' | 'consumer' | 'store' }
type TopoEdge = { from: string; to: string; label?: string }
type TopoMode = { name: string; description?: string; nodes: TopoNode[]; edges: TopoEdge[] }

const props = defineProps<{ title?: string; modes: TopoMode[] }>()

const active = ref(0)
const flowStep = ref(-1)
let timer: ReturnType<typeof setInterval> | undefined

const mode = computed(() => props.modes[active.value] ?? props.modes[0])

function nodeLabel(id: string) {
  return mode.value.nodes.find((n) => n.id === id)?.label ?? id
}

function stopFlow() {
  if (timer) clearInterval(timer)
  timer = undefined
}

function selectMode(i: number) {
  active.value = i
  stopFlow()
  flowStep.value = -1
}

function playFlow() {
  stopFlow()
  flowStep.value = 0
  timer = setInterval(() => {
    if (flowStep.value >= mode.value.edges.length - 1) {
      stopFlow()
      return
    }
    flowStep.value += 1
  }, 800)
}

onUnmounted(stopFlow)

function edgeState(i: number) {
  if (flowStep.value < 0) return ''
  if (i === flowStep.value) return 'topology-diagram__edge--current'
  if (i < flowStep.value) return 'topology-diagram__edge--done'
  return 'topology-diagram__edge--dim'
}

function nodeInFlow(id: string) {
  if (flowStep.value < 0) return false
  return mode.value.edges
    .slice(0, flowStep.value + 1)
    .some((e) => e.from === id || e.to === id)
}
</script>

<template>
  <div class="topology-diagram">
    <div v-if="title" class="topology-diagram__title">{{ title }}</div>
    <div class="topology-diagram__modes">
      <button
        v-for="(m, i) in modes"
        :key="m.name"
        type="button"
        class="topology-diagram__mode-btn"
        :class="{ 'topology-diagram__mode-btn--active': i === active }"
        @click="selectMode(i)"
      >
        {{ m.name }}
      </button>
      <button type="button" class="topology-diagram__mode-btn topology-diagram__mode-btn--play" @click="playFlow">
        ▶ 播放消息流
      </button>
    </div>
    <p v-if="mode.description" class="topology-diagram__desc">{{ mode.description }}</p>
    <div class="topology-diagram__nodes">
      <span
        v-for="node in mode.nodes"
        :key="node.id"
        class="topology-diagram__node"
        :class="[`topology-diagram__node--${node.kind ?? 'broker'}`, { 'topology-diagram__node--lit': nodeInFlow(node.id) }]"
      >
        {{ node.label }}
      </span>
    </div>
    <ul class="topology-diagram__edges">
      <li v-for="(edge, i) in mode.edges" :key="i" class="topology-diagram__edge" :class="edgeState(i)">
        {{ nodeLabel(edge.from) }} → {{ nodeLabel(edge.to) }}
        <span v-if="edge.label" class="topology-diagram__edge-label">（{{ edge.label }}）</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.topology-diagram {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 16px 0;
  background: var(--vp-c-bg-soft);
}
.topology-diagram__title {
  font-weight: 600;
  margin-bottom: 8px;
}
.topology-diagram__modes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.topology-diagram__mode-btn {
  font-size: 12px;
  padding: 3px 12px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
}
.topology-diagram__mode-btn--active {
  border-color: #2563eb;
  color: #2563eb;
  font-weight: 600;
}
.topology-diagram__mode-btn--play {
  border-color: rgba(16, 185, 129, 0.5);
  color: #059669;
}
.topology-diagram__desc {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.topology-diagram__nodes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.topology-diagram__node {
  font-size: 13px;
  padding: 3px 10px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  transition: box-shadow 0.3s, border-color 0.3s;
}
.topology-diagram__node--producer {
  border-color: rgba(59, 130, 246, 0.5);
  color: #2563eb;
}
.topology-diagram__node--broker {
  border-color: rgba(16, 185, 129, 0.5);
  color: #059669;
  font-weight: 600;
}
.topology-diagram__node--consumer {
  border-color: rgba(245, 158, 11, 0.5);
  color: #d97706;
}
.topology-diagram__node--store {
  border-color: rgba(139, 92, 246, 0.5);
  color: #7c3aed;
}
.topology-diagram__node--lit {
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
}
.topology-diagram__edges {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--vp-c-text-2);
}
.topology-diagram__edge {
  transition: color 0.3s, opacity 0.3s;
}
.topology-diagram__edge--current {
  color: #2563eb;
  font-weight: 600;
}
.topology-diagram__edge--done {
  color: #059669;
}
.topology-diagram__edge--dim {
  opacity: 0.4;
}
.topology-diagram__edge-label {
  color: var(--vp-c-text-3);
}
</style>
