<script setup lang="ts">
interface Stage {
  name: string
  status: 'ok' | 'fail' | 'retry' | 'pending'
  detail?: string
}

withDefaults(defineProps<{ title?: string; stages: Stage[] }>(), { title: '消息轨迹' })
</script>

<template>
  <div class="message-trace">
    <div class="message-trace__title">{{ title }}</div>
    <div class="message-trace__flow">
      <template v-for="(stage, i) in stages" :key="stage.name">
        <div class="message-trace__stage" :class="`message-trace__stage--${stage.status}`">
          <div class="message-trace__name">{{ stage.name }}</div>
          <div v-if="stage.detail" class="message-trace__detail">{{ stage.detail }}</div>
        </div>
        <div v-if="i < stages.length - 1" class="message-trace__arrow">→</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.message-trace {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 16px 0;
  background: var(--vp-c-bg-soft);
}
.message-trace__title {
  font-weight: 600;
  margin-bottom: 8px;
}
.message-trace__flow {
  display: flex;
  align-items: stretch;
  gap: 8px;
  flex-wrap: wrap;
}
.message-trace__stage {
  border-radius: 6px;
  padding: 6px 10px;
  min-width: 110px;
  border: 1px solid var(--vp-c-divider);
}
.message-trace__name {
  font-weight: 600;
  font-size: 13px;
}
.message-trace__detail {
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.message-trace__stage--ok {
  border-color: #059669;
}
.message-trace__stage--fail {
  border-color: #dc2626;
}
.message-trace__stage--retry {
  border-color: #d97706;
}
.message-trace__arrow {
  align-self: center;
  color: var(--vp-c-text-2);
}
</style>
