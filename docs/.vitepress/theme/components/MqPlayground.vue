<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { data as catalog } from '../data/replay-evidence.data'
import type { ReplayAction, ReplayCatalogEntry, ReplayEvent, ReplayTrack } from '../data/replay'
import { clampReplayStep, moveReplayStep, resolveReplayAction } from '../data/replay-player'

const productLabels = {
  rabbitmq: 'RabbitMQ',
  kafka: 'Kafka',
  'redis-streams': 'Redis Streams',
} as const

const selectedProduct = ref<keyof typeof productLabels>('rabbitmq')
const selectedScenario = ref('basic')
const selectedTrack = ref('')
const step = ref(0)
const speed = ref(1)
const playing = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const products = computed(() => Object.keys(productLabels) as Array<keyof typeof productLabels>)
const scenarios = computed(() => catalog.filter((entry) => entry.product === selectedProduct.value))
const entry = computed<ReplayCatalogEntry | undefined>(() =>
  scenarios.value.find((item) => item.id === selectedScenario.value),
)
const scenario = computed(() => entry.value?.scenario)
const tracks = computed(() => scenario.value?.tracks ?? [])
const track = computed<ReplayTrack | undefined>(() =>
  tracks.value.find((item) => item.id === selectedTrack.value) ?? tracks.value[0],
)
const events = computed(() => track.value?.events ?? [])
const event = computed<ReplayEvent | undefined>(() => events.value[step.value])
const canPlay = computed(() => events.value.length > 1)
const progress = computed(() => events.value.length <= 1 ? 0 : (step.value / (events.value.length - 1)) * 100)
const statusLabel = computed(() => {
  if (entry.value?.evidenceStatus === 'verified') return 'Docker 证据已验证'
  if (entry.value?.evidenceStatus === 'failed') return '证据文件无效'
  return '等待 Docker 采集'
})

function stop() {
  playing.value = false
  if (timer) clearTimeout(timer)
  timer = undefined
}

function reset() {
  stop()
  selectedTrack.value = scenario.value?.defaultTrack ?? tracks.value[0]?.id ?? ''
  step.value = 0
  syncUrl()
}

function previous() {
  stop()
  step.value = moveReplayStep(events.value, step.value, -1)
  syncUrl()
}

function next() {
  if (step.value >= events.value.length - 1) {
    stop()
    return
  }
  step.value = moveReplayStep(events.value, step.value, 1)
  syncUrl()
}

function schedule() {
  if (!playing.value) return
  if (step.value >= events.value.length - 1) {
    stop()
    return
  }
  const base = events.value[step.value + 1]?.delayMs ?? 700
  timer = setTimeout(() => {
    step.value += 1
    syncUrl()
    schedule()
  }, Math.max(120, base / speed.value))
}

function togglePlay() {
  if (!canPlay.value) return
  if (playing.value) {
    stop()
    return
  }
  if (step.value >= events.value.length - 1) step.value = 0
  playing.value = true
  schedule()
}

function chooseAction(action: ReplayAction) {
  const target = resolveReplayAction(tracks.value, action)
  if (!target) return
  stop()
  selectedTrack.value = target.track
  step.value = target.step
  syncUrl()
}

function chooseProduct() {
  const fallback = scenarios.value.find((item) => item.id === 'basic') ?? scenarios.value[0]
  selectedScenario.value = fallback?.id ?? ''
  reset()
}

function chooseScenario() {
  reset()
}

function chooseTrack() {
  stop()
  step.value = 0
  syncUrl()
}

function setStep(value: number) {
  stop()
  step.value = clampReplayStep(events.value, value)
  syncUrl()
}

function syncUrl() {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  params.set('product', selectedProduct.value)
  params.set('scenario', selectedScenario.value)
  if (selectedTrack.value) params.set('track', selectedTrack.value)
  if (step.value > 0) params.set('step', String(step.value))
  window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`)
}

function loadUrl() {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const product = params.get('product') as keyof typeof productLabels | null
  const scenarioId = params.get('scenario')
  const requested = catalog.find((item) => item.product === product && item.id === scenarioId)
  const fallback = catalog.find((item) => item.product === 'rabbitmq' && item.id === 'basic')
  const resolved = requested ?? fallback
  if (!resolved) return
  selectedProduct.value = resolved.product
  selectedScenario.value = resolved.id
  const availableTracks = resolved.scenario?.tracks ?? []
  const trackId = params.get('track')
  selectedTrack.value = availableTracks.some((item) => item.id === trackId)
    ? trackId!
    : resolved.scenario?.defaultTrack ?? availableTracks[0]?.id ?? ''
  const requestedStep = Number.parseInt(params.get('step') ?? '0', 10)
  step.value = Number.isFinite(requestedStep)
    ? clampReplayStep(availableTracks.find((item) => item.id === selectedTrack.value)?.events ?? [], requestedStep)
    : 0
  if (!requested) nextTick(syncUrl)
}

function onKeydown(keyboardEvent: KeyboardEvent) {
  if (keyboardEvent.target instanceof HTMLInputElement || keyboardEvent.target instanceof HTMLSelectElement) return
  if (keyboardEvent.key === 'ArrowLeft') previous()
  if (keyboardEvent.key === 'ArrowRight') next()
  if (keyboardEvent.key === ' ') {
    keyboardEvent.preventDefault()
    togglePlay()
  }
}

watch(speed, () => {
  if (playing.value) {
    stop()
    playing.value = true
    schedule()
  }
})

onMounted(() => {
  loadUrl()
  window.addEventListener('popstate', loadUrl)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  stop()
  if (typeof window !== 'undefined') {
    window.removeEventListener('popstate', loadUrl)
    window.removeEventListener('keydown', onKeydown)
  }
})
</script>

<template>
  <section class="mq-playground" aria-label="MQ Docker 证据回放实验台">
    <div class="mq-playground__toolbar">
      <label>产品
        <select v-model="selectedProduct" @change="chooseProduct">
          <option v-for="product in products" :key="product" :value="product">{{ productLabels[product] }}</option>
        </select>
      </label>
      <label>场景
        <select v-model="selectedScenario" @change="chooseScenario">
          <option v-for="item in scenarios" :key="item.id" :value="item.id">{{ item.title }}</option>
        </select>
      </label>
      <label v-if="tracks.length > 1">证据轨道
        <select v-model="selectedTrack" @change="chooseTrack">
          <option v-for="item in tracks" :key="item.id" :value="item.id">{{ item.label }}</option>
        </select>
      </label>
      <span class="mq-playground__status" :data-status="entry?.evidenceStatus">{{ statusLabel }}</span>
      <code v-if="scenario?.image.reference">{{ scenario.image.reference }}@{{ scenario.image.digest.slice(0, 12) }}</code>
    </div>

    <div v-if="!scenario" class="mq-playground__unavailable" role="status">
      <strong>{{ entry?.title }}：尚无可回放的 Docker 证据</strong>
      <p>页面不会推演或伪造结果。请在具备 Docker、Compose、Bash、Maven 与 jq 的环境执行：</p>
      <pre><code>npm run collect:playground -- --scenario {{ entry?.product }}/{{ entry?.id }}</code></pre>
      <p><a :href="entry?.document">查看实验说明与现有证据</a></p>
    </div>

    <template v-else>
      <div class="mq-playground__controls" aria-label="回放控制">
        <button type="button" :disabled="step === 0" title="上一步（←）" @click="previous">← 上一步</button>
        <button type="button" :disabled="!canPlay" title="播放或暂停（空格）" @click="togglePlay">{{ playing ? '暂停' : '播放' }}</button>
        <button type="button" :disabled="step >= events.length - 1" title="下一步（→）" @click="next">下一步 →</button>
        <button type="button" :disabled="step === 0 && selectedTrack === scenario.defaultTrack" @click="reset">重置</button>
        <label>速度
          <select v-model.number="speed">
            <option :value="0.5">0.5×</option>
            <option :value="1">1×</option>
            <option :value="2">2×</option>
          </select>
        </label>
        <span>{{ step + 1 }} / {{ events.length }}</span>
      </div>

      <div class="mq-playground__topology" aria-label="当前拓扑状态">
        <template v-for="(node, index) in event?.state.nodes ?? scenario.topology" :key="node.id">
          <div class="mq-playground__node" :data-kind="node.kind" :data-state="node.status">
            <span>{{ node.label }}</span><small>{{ node.status }}</small>
          </div>
          <span v-if="index < (event?.state.nodes ?? scenario.topology).length - 1" class="mq-playground__arrow">→</span>
        </template>
      </div>

      <dl class="mq-playground__metrics">
        <template v-for="(value, key) in event?.state.metrics" :key="key">
          <dt>{{ key }}</dt><dd>{{ value ?? '—' }}</dd>
        </template>
      </dl>

      <div class="mq-playground__timeline">
        <div class="mq-playground__progress"><span :style="{ width: `${progress}%` }"></span></div>
        <button
          v-for="(item, index) in events"
          :key="`${item.track}-${item.sequence}`"
          type="button"
          :class="{ current: index === step, passed: index < step }"
          :title="item.title"
          @click="setStep(index)"
        ><span>{{ index + 1 }}</span><small>{{ item.type }}</small></button>
      </div>

      <div v-if="event?.actions?.length" class="mq-playground__actions">
        <span>证据分支</span>
        <button v-for="action in event.actions" :key="action.id" type="button" @click="chooseAction(action)">{{ action.label }}</button>
      </div>

      <div class="mq-playground__detail">
        <section>
          <h2>当前事件</h2>
          <p><strong>{{ event?.title }}</strong> <code>+{{ event?.relativeMs }} ms</code></p>
          <dl>
            <template v-for="(value, key) in event?.state.message" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></template>
          </dl>
        </section>
        <section>
          <h2>业务状态</h2>
          <dl>
            <template v-for="(value, key) in event?.state.business" :key="key"><dt>{{ key }}</dt><dd>{{ value }}</dd></template>
          </dl>
        </section>
      </div>

      <details class="mq-playground__evidence" open>
        <summary>原始证据</summary>
        <div v-for="ref in event?.evidence" :key="`${ref.file}:${ref.line}`">
          <code>{{ ref.file }}:{{ ref.line }}</code><span>{{ ref.role }}</span>
          <pre>{{ ref.content }}</pre>
        </div>
        <div v-if="scenario.assertions.length">
          <strong>最终断言</strong>
          <pre>{{ scenario.assertions.map((item) => item.content).join('\n') }}</pre>
        </div>
      </details>
    </template>
  </section>
</template>

<style scoped>
.mq-playground { margin: 20px 0 32px; border-top: 1px solid var(--vp-c-divider); border-bottom: 1px solid var(--vp-c-divider); }
.mq-playground__toolbar, .mq-playground__controls { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 14px; padding: 10px 0; border-bottom: 1px solid var(--vp-c-divider); font-size: 13px; }
.mq-playground label { display: inline-flex; align-items: center; gap: 6px; color: var(--vp-c-text-2); }
.mq-playground select, .mq-playground button { border: 1px solid var(--vp-c-divider); border-radius: 5px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font: inherit; }
.mq-playground select { padding: 4px 24px 4px 8px; }
.mq-playground button { padding: 4px 10px; cursor: pointer; }
.mq-playground button:disabled { cursor: not-allowed; opacity: .42; }
.mq-playground button:focus-visible, .mq-playground select:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }
.mq-playground__status { margin-left: auto; padding-left: 10px; border-left: 3px solid var(--vp-c-warning-1); color: var(--vp-c-text-2); }
.mq-playground__status[data-status='verified'] { border-color: var(--vp-c-success-1); }
.mq-playground__status[data-status='failed'] { border-color: var(--vp-c-danger-1); }
.mq-playground__unavailable { padding: 32px 0; }
.mq-playground__unavailable p { margin: 8px 0; color: var(--vp-c-text-2); }
.mq-playground__unavailable pre { max-width: 100%; min-width: 0; overflow-x: auto; }
.mq-playground__unavailable pre code { white-space: pre; }
.mq-playground__topology { display: flex; align-items: stretch; justify-content: center; gap: 8px; padding: 24px 8px; overflow-x: auto; }
.mq-playground__node { min-width: 112px; padding: 9px 12px; border: 1px solid var(--vp-c-divider); border-top: 3px solid var(--vp-c-brand-1); border-radius: 6px; background: var(--vp-c-bg); text-align: center; }
.mq-playground__node[data-kind='queue'] { border-top-color: #8b5cf6; }
.mq-playground__node[data-kind='consumer'] { border-top-color: #f59e0b; }
.mq-playground__node[data-kind='database'] { border-top-color: #10b981; }
.mq-playground__node[data-state='failed'] { border-color: var(--vp-c-danger-1); }
.mq-playground__node[data-state='active'] { box-shadow: 0 0 0 2px color-mix(in srgb, var(--vp-c-brand-1) 25%, transparent); }
.mq-playground__node span, .mq-playground__node small { display: block; white-space: nowrap; }
.mq-playground__node small { margin-top: 3px; color: var(--vp-c-text-3); }
.mq-playground__arrow { align-self: center; color: var(--vp-c-text-3); }
.mq-playground__metrics { display: flex; flex-wrap: wrap; margin: 0; padding: 9px 0; border-top: 1px solid var(--vp-c-divider); border-bottom: 1px solid var(--vp-c-divider); }
.mq-playground__metrics dt { margin-left: 14px; color: var(--vp-c-text-3); }
.mq-playground__metrics dd { margin: 0 14px 0 5px; font-variant-numeric: tabular-nums; font-weight: 600; }
.mq-playground__timeline { position: relative; display: flex; gap: 4px; overflow-x: auto; padding: 24px 0 10px; }
.mq-playground__progress { position: absolute; top: 16px; left: 0; right: 0; height: 2px; background: var(--vp-c-divider); }
.mq-playground__progress span { display: block; height: 100%; background: var(--vp-c-brand-1); transition: width .2s; }
.mq-playground__timeline button { position: relative; min-width: 78px; padding: 8px 6px 4px; border: 0; background: transparent; color: var(--vp-c-text-3); }
.mq-playground__timeline button > span { position: absolute; top: -18px; left: 50%; width: 18px; height: 18px; border: 2px solid var(--vp-c-divider); border-radius: 50%; background: var(--vp-c-bg); line-height: 14px; transform: translateX(-50%); }
.mq-playground__timeline button.passed, .mq-playground__timeline button.current { color: var(--vp-c-text-1); }
.mq-playground__timeline button.passed > span, .mq-playground__timeline button.current > span { border-color: var(--vp-c-brand-1); }
.mq-playground__timeline button.current > span { background: var(--vp-c-brand-1); color: white; }
.mq-playground__actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 10px 0; border-top: 1px solid var(--vp-c-divider); }
.mq-playground__actions > span { color: var(--vp-c-text-2); font-size: 13px; }
.mq-playground__actions button { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.mq-playground__detail { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; padding: 8px 0 18px; }
.mq-playground__detail h2 { margin: 16px 0 8px; padding: 0; border: 0; font-size: 16px; }
.mq-playground__detail p { margin: 0 0 8px; }
.mq-playground__detail dl { display: grid; grid-template-columns: max-content 1fr; gap: 3px 12px; margin: 0; font-size: 13px; }
.mq-playground__detail dt { color: var(--vp-c-text-3); }
.mq-playground__detail dd { margin: 0; overflow-wrap: anywhere; }
.mq-playground__evidence { border-top: 1px solid var(--vp-c-divider); padding: 12px 0; }
.mq-playground__evidence summary { cursor: pointer; font-weight: 600; }
.mq-playground__evidence > div { margin-top: 10px; }
.mq-playground__evidence span { margin-left: 8px; color: var(--vp-c-text-3); font-size: 12px; }
.mq-playground__evidence pre { max-height: 220px; margin: 5px 0 0; padding: 10px 12px; overflow: auto; background: var(--vp-code-block-bg); font-size: 12px; white-space: pre-wrap; }
@media (max-width: 640px) {
  .mq-playground__status { width: 100%; margin-left: 0; }
  .mq-playground__topology { justify-content: flex-start; }
  .mq-playground__detail { grid-template-columns: 1fr; gap: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .mq-playground__progress span { transition: none; }
}
</style>
