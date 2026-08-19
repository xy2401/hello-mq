<script setup lang="ts">
// 产品页头的版本徽章（规格 §10.2）：展示本仓库验证过的镜像与客户端版本基线。
defineProps<{ product: string; broker: string; client?: string; image?: string; logo?: 'rabbitmq' | 'kafka' | 'rocketmq' | 'pulsar' }>()
</script>

<template>
  <div class="version-badge">
    <span class="version-badge__item version-badge__item--product">
      <ProductLogo v-if="logo" :product="logo" :size="14" />
      {{ product }}
    </span>
    <span class="version-badge__item">broker {{ broker }}</span>
    <span v-if="client" class="version-badge__item">client {{ client }}</span>
    <span v-if="image" class="version-badge__item version-badge__item--image" :title="image">tag+digest 双锁</span>
  </div>
</template>

<style scoped>
.version-badge {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 16px;
}
.version-badge__item {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
}
.version-badge__item--product {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.version-badge__item--image {
  border-color: rgba(16, 185, 129, 0.5);
  color: #059669;
}
</style>
