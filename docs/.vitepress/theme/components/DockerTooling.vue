<template>
  <div v-if="entry" class="docker-tooling-container">
    <!-- Compact Header Bar -->
    <div class="dt-header-bar">
      <div class="dt-badge-row">
        <span class="dt-product-tag">{{ entry.name }}</span>
        <span class="dt-status-pill" :class="`status-${statusKey}`">
          <span class="status-pulse"></span>
          {{ statusLabel }}
        </span>
        <span v-if="meta.capturedAt" class="dt-meta-time">
          🕒 快照采集: {{ formattedCaptureTime }}
        </span>
      </div>
      <p v-if="entry.note" class="dt-header-note">{{ entry.note }}</p>
    </div>

    <!-- Compact Spec & Commands Strip -->
    <div class="dt-spec-strip">
      <!-- Image & Key Tools Row -->
      <div class="dt-meta-row">
        <div class="dt-meta-item">
          <span class="dt-meta-label">🐳 镜像:</span>
          <span class="dt-meta-val dt-images-inline">
            <span v-for="(img, i) in entry.images" :key="i" class="dt-img-pill">
              <span class="dt-img-role">{{ img.role }}:</span>
              <code>{{ img.tag }}</code>
            </span>
          </span>
        </div>

        <div v-if="entry.keyTools?.length" class="dt-meta-item">
          <span class="dt-meta-label">🛠️ 关键工具:</span>
          <span class="dt-meta-val dt-tools-inline">
            <code v-for="t in entry.keyTools" :key="t" class="dt-inline-tool">{{ t }}</code>
          </span>
        </div>
      </div>

      <!-- Compact Command Lines -->
      <div
        v-if="entry.buildCommand || entry.runCommand || entry.queryCommand || entry.connectCommand"
        class="dt-cmd-rows"
      >
        <div v-if="entry.buildCommand" class="dt-cmd-row">
          <span class="dt-cmd-tag">🔨 构建/检查</span>
          <code class="dt-cmd-text" :title="entry.buildCommand">{{ entry.buildCommand }}</code>
          <button class="dt-mini-copy" @click="copyText(entry.buildCommand, 'build')">
            {{ copiedTarget === 'build' ? '已复制 ✓' : '复制' }}
          </button>
        </div>

        <div
          v-if="entry.runCommand || entry.queryCommand || entry.connectCommand"
          class="dt-cmd-row"
        >
          <span class="dt-cmd-tag">🚀 运行/交互</span>
          <code
            class="dt-cmd-text"
            :title="entry.runCommand || entry.queryCommand || entry.connectCommand"
          >{{ entry.runCommand || entry.queryCommand || entry.connectCommand }}</code>
          <button
            class="dt-mini-copy"
            @click="copyText(entry.runCommand || entry.queryCommand || entry.connectCommand, 'run')"
          >
            {{ copiedTarget === 'run' ? '已复制 ✓' : '复制' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Interactive Evidence Workbench -->
    <div class="dt-workbench">
      <div class="dt-tabs">
        <button
          v-for="tab in availableTabs"
          :key="tab.id"
          class="dt-tab-btn"
          :class="{ active: currentTab === tab.id }"
          @click="currentTab = tab.id"
        >
          <span class="dt-tab-icon">{{ tab.icon }}</span>
          <span class="dt-tab-text">{{ tab.label }}</span>
          <span v-if="tab.count !== undefined" class="dt-tab-count">({{ tab.count }})</span>
        </button>
      </div>

      <!-- Tab 1: Execution Session -->
      <div v-if="currentTab === 'session'" class="dt-tab-panel">
        <div class="dt-terminal">
          <div class="dt-terminal-header">
            <div class="dt-window-dots">
              <span class="dt-dot red"></span>
              <span class="dt-dot yellow"></span>
              <span class="dt-dot green"></span>
            </div>
            <span class="dt-terminal-title">docker-session.out.txt</span>
            <div class="dt-terminal-actions">
              <span v-if="meta.timeMs" class="dt-time-badge">⏱️ {{ meta.timeMs }}ms</span>
              <button class="dt-terminal-copy-btn" @click="copyText(sessionRaw, 'session')">
                {{ copiedTarget === 'session' ? '已复制 ✓' : '复制输出' }}
              </button>
            </div>
          </div>
          <div class="dt-terminal-content">
            <pre class="dt-terminal-pre"><code>{{ sessionCleanBody || '暂无会话快照输出' }}</code></pre>
          </div>
        </div>
      </div>

      <!-- Tab 2: Inventory & Tools -->
      <div v-if="currentTab === 'inventory'" class="dt-tab-panel">
        <div class="dt-inventory-box">
          <div class="dt-inventory-toolbar">
            <div class="dt-search-box">
              <span class="dt-search-icon">🔍</span>
              <input
                v-model="toolSearch"
                type="text"
                class="dt-search-input"
                :placeholder="`搜索镜像内置工具，如 git, curl, ${entry.keyTools?.[0] || 'gcc'}... (共 ${allTools.length} 个)`"
              />
              <button v-if="toolSearch" class="dt-clear-search" @click="toolSearch = ''">✕</button>
            </div>
            <div class="dt-view-toggle">
              <button
                class="dt-toggle-btn"
                :class="{ active: inventoryView === 'chips' }"
                @click="inventoryView = 'chips'"
              >
                标签视图
              </button>
              <button
                class="dt-toggle-btn"
                :class="{ active: inventoryView === 'raw' }"
                @click="inventoryView = 'raw'"
              >
                原始清单
              </button>
            </div>
          </div>

          <!-- Inventory Chips Mode -->
          <div v-if="inventoryView === 'chips'" class="dt-inventory-chips-wrap">
            <div
              v-if="inventoryMeta.os || inventoryMeta.arch || inventoryMeta.size || inventoryMeta.path"
              class="dt-env-meta-bar"
            >
              <span v-if="inventoryMeta.os" class="dt-env-item">🐧 <strong>系统:</strong> {{ inventoryMeta.os }}</span>
              <span v-if="inventoryMeta.arch" class="dt-env-item">⚙️ <strong>架构:</strong> {{ inventoryMeta.arch }}</span>
              <span v-if="inventoryMeta.size" class="dt-env-item">💾 <strong>体积:</strong> {{ inventoryMeta.size }}</span>
              <span v-if="inventoryMeta.path" class="dt-env-item dt-env-path">📁 <strong>PATH:</strong> <code>{{ inventoryMeta.path }}</code></span>
            </div>

            <div v-if="filteredTools.length" class="dt-tools-cloud">
              <span
                v-for="tool in filteredTools"
                :key="tool"
                class="dt-tool-chip"
                :class="{ 'is-key': isKeyTool(tool) }"
                :title="isKeyTool(tool) ? `${tool} (核心工具)` : tool"
              >
                <span v-if="isKeyTool(tool)" class="dt-key-badge">核心</span>
                {{ tool }}
              </span>
            </div>
            <div v-else class="dt-empty-tools">
              未找到与 <code>{{ toolSearch }}</code> 匹配的内置工具
            </div>
          </div>

          <!-- Inventory Raw Mode -->
          <div v-else class="dt-terminal-content">
            <pre class="dt-terminal-pre"><code>{{ inventoryCleanBody || '暂无工具清单数据' }}</code></pre>
          </div>
        </div>
      </div>

      <!-- Tab 3: Assertions -->
      <div v-if="currentTab === 'assert'" class="dt-tab-panel">
        <div class="dt-assert-wrapper">
          <div class="dt-assert-cards">
            <div class="dt-audit-card" :class="{ pass: meta.status === 'verified' }">
              <div class="dt-audit-icon">{{ meta.status === 'verified' ? '✅' : '⏳' }}</div>
              <div class="dt-audit-main">
                <div class="dt-audit-title">快照验证状态 (Evidence Status)</div>
                <div class="dt-audit-desc">
                  {{ meta.status === 'verified' ? '已通过全流程实机容器运行断言' : '当前处于配置记录状态，待工作流全量实测' }}
                </div>
              </div>
              <span class="dt-audit-badge">{{ meta.status || 'documented' }}</span>
            </div>

            <div class="dt-audit-card" :class="{ pass: meta.exitCode === '0' || meta.exitCode === 0 }">
              <div class="dt-audit-icon">{{ (meta.exitCode === '0' || meta.exitCode === 0) ? '✅' : '⏳' }}</div>
              <div class="dt-audit-main">
                <div class="dt-audit-title">进程退出码 (Exit Code)</div>
                <div class="dt-audit-desc">
                  {{ meta.exitCode !== undefined ? `最后执行退出码为 0，程序无报错退出` : '未采集到有效退出码' }}
                </div>
              </div>
              <span class="dt-audit-badge">exitCode: {{ meta.exitCode ?? '-' }}</span>
            </div>

            <div class="dt-audit-card" :class="{ pass: Boolean(meta.dockerImage) }">
              <div class="dt-audit-icon">{{ meta.dockerImage ? '✅' : '⏳' }}</div>
              <div class="dt-audit-main">
                <div class="dt-audit-title">不可变镜像摘要 (Digest Lock)</div>
                <div class="dt-audit-desc dt-ellipsis" :title="meta.dockerImage || '未采集'">
                  <code>{{ meta.dockerImage || '未记录镜像 SHA256 摘要' }}</code>
                </div>
              </div>
              <span class="dt-audit-badge">SHA256 锁定</span>
            </div>
          </div>

          <div class="dt-assert-raw-box">
            <div class="dt-assert-raw-header">
              <span>完整断言快照 (assert.out.txt)</span>
              <button class="dt-copy-btn" @click="copyText(assertRaw, 'assert')">
                {{ copiedTarget === 'assert' ? '已复制 ✓' : '复制' }}
              </button>
            </div>
            <pre class="dt-terminal-pre"><code>{{ assertCleanBody || '暂无断言记录' }}</code></pre>
          </div>
        </div>
      </div>

      <!-- Tab 4: Native Windows (For PowerShell) -->
      <div v-if="currentTab === 'native'" class="dt-tab-panel">
        <div class="dt-terminal">
          <div class="dt-terminal-header">
            <div class="dt-window-dots">
              <span class="dt-dot red"></span>
              <span class="dt-dot yellow"></span>
              <span class="dt-dot green"></span>
            </div>
            <span class="dt-terminal-title">windows-powershell-native.session.out.txt</span>
            <button class="dt-terminal-copy-btn" @click="copyText(nativeSessionRaw, 'native')">
              {{ copiedTarget === 'native' ? '已复制 ✓' : '复制输出' }}
            </button>
          </div>
          <div class="dt-terminal-content">
            <pre class="dt-terminal-pre"><code>{{ nativeSessionRaw || '暂无 Windows 原生会话快照' }}</code></pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { dockerCatalogById } from '../data/dockerCatalog';
import { dockerEvidence } from '../data/dockerEvidence';

const props = defineProps<{ product: string }>();
const entry = computed(() => dockerCatalogById[props.product]);

// Evidence sources
const inventoryRaw = computed(() => dockerEvidence(props.product, 'inventory') || '');
const sessionRaw = computed(() => dockerEvidence(props.product, 'session') || '');
const assertRaw = computed(() => dockerEvidence(props.product, 'assert') || '');

// PowerShell native sources if available
const nativeSessionRaw = computed(() => {
  try {
    return dockerEvidence(props.product, 'native.session' as any) || '';
  } catch {
    return '';
  }
});

// Frontmatter & Body parser helper
function parseFrontmatter(raw: string) {
  if (!raw || !raw.startsWith('---')) return { meta: {} as Record<string, any>, body: (raw || '').trim() };
  const splitIdx = raw.indexOf('\n---\n', 3);
  const splitIdxWin = raw.indexOf('\r\n---\r\n', 3);
  const actualSplit = splitIdxWin !== -1 ? splitIdxWin : splitIdx;
  
  if (actualSplit !== -1) {
    const isWin = splitIdxWin !== -1;
    const header = raw.slice(isWin ? 5 : 4, actualSplit);
    const body = raw.slice(actualSplit + (isWin ? 7 : 5)).trim();
    const meta: Record<string, any> = {};
    for (const line of header.split(/\r?\n/)) {
      const idx = line.indexOf(':');
      if (idx > 0) {
        const k = line.slice(0, idx).trim();
        let v = line.slice(idx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        meta[k] = v;
      }
    }
    return { meta, body };
  }
  return { meta: {} as Record<string, any>, body: raw.trim() };
}

const parsedInventory = computed(() => parseFrontmatter(inventoryRaw.value));
const parsedSession = computed(() => parseFrontmatter(sessionRaw.value));
const parsedAssert = computed(() => parseFrontmatter(assertRaw.value));

const meta = computed(() => ({
  ...parsedInventory.value.meta,
  ...parsedSession.value.meta,
  ...parsedAssert.value.meta,
}));

const sessionCleanBody = computed(() => parsedSession.value.body);
const inventoryCleanBody = computed(() => parsedInventory.value.body);
const assertCleanBody = computed(() => parsedAssert.value.body);

// Status label and verification state
const isAllPassed = computed(() => /status:\s*verified/.test(assertRaw.value) || meta.value.status === 'verified');
const statusKey = computed(() => {
  if (entry.value?.status === 'unsupported' || entry.value?.mode === 'browser') return 'unsupported';
  if (isAllPassed.value) return 'verified';
  if (entry.value?.status === 'partial') return 'partial';
  return 'documented';
});

const statusLabel = computed(() => {
  const map: Record<string, string> = {
    verified: '已验证 · Verified',
    partial: '部分验证 · Partial',
    documented: '待首次采集 · Documented',
    unsupported: '免容器 / 独立运行',
  };
  return map[statusKey.value] || '待首次采集';
});

const formattedCaptureTime = computed(() => {
  if (!meta.value.capturedAt) return '';
  try {
    const d = new Date(meta.value.capturedAt);
    return isNaN(d.getTime()) ? meta.value.capturedAt : d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  } catch {
    return meta.value.capturedAt;
  }
});

// Inventory analysis (extract tools, OS, arch, size, PATH)
const inventoryMeta = computed(() => {
  const body = inventoryCleanBody.value;
  const res: { os?: string; arch?: string; size?: string; path?: string } = {};

  const osMatch = body.match(/\bos=([^\s]+)/i) || body.match(/PRETTY_NAME="([^"]+)"/);
  if (osMatch) res.os = osMatch[1];

  const archMatch = body.match(/\barch(?:itecture)?=([^\s]+)/i);
  if (archMatch) res.arch = archMatch[1];

  const sizeMatch = body.match(/\bsize(?:Bytes)?=([0-9]+)/i);
  if (sizeMatch) {
    const bytes = parseInt(sizeMatch[1], 10);
    if (!isNaN(bytes)) {
      res.size = bytes > 1024 * 1024 * 1024
        ? `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
        : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
  }

  const pathMatch = body.match(/PATH=([^\r\n]+)/);
  if (pathMatch) res.path = pathMatch[1];

  return res;
});

// Parse all tools list from inventory
const allTools = computed(() => {
  const body = inventoryCleanBody.value;
  if (!body) return entry.value?.keyTools || [];
  const lines = body.split(/\r?\n/);
  const toolsSet = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('$') || trimmed.startsWith('id=') || trimmed.startsWith('PATH=') || trimmed.startsWith('NAME=') || trimmed.startsWith('VERSION') || trimmed.startsWith('PRETTY_') || trimmed.startsWith('HOME_') || trimmed.startsWith('BUG_')) {
      continue;
    }
    if (trimmed === '[' || trimmed === ']') {
      continue;
    }

    if (trimmed.startsWith('/')) {
      const base = trimmed.split('/').pop();
      if (base) toolsSet.add(base);
    } else if (/^[a-zA-Z0-9._+-]+$/.test(trimmed)) {
      toolsSet.add(trimmed);
    }
  }

  if (toolsSet.size === 0 && entry.value?.keyTools) {
    entry.value.keyTools.forEach((t: string) => toolsSet.add(t));
  }

  return Array.from(toolsSet).sort();
});

const toolSearch = ref('');
const inventoryView = ref<'chips' | 'raw'>('chips');

const filteredTools = computed(() => {
  const q = toolSearch.value.trim().toLowerCase();
  if (!q) return allTools.value;
  return allTools.value.filter((t) => t.toLowerCase().includes(q));
});

function isKeyTool(tool: string) {
  return Boolean(entry.value?.keyTools?.some((k: string) => k.toLowerCase() === tool.toLowerCase()));
}

// Tabs handling
const currentTab = ref<'session' | 'inventory' | 'assert' | 'native'>('session');

const availableTabs = computed(() => {
  const tabs = [
    { id: 'session' as const, label: '运行与会话', icon: '🖥️' },
    { id: 'inventory' as const, label: '环境与工具清单', icon: '📦', count: allTools.value.length },
    { id: 'assert' as const, label: '断言与审计', icon: '🛡️' },
  ];
  if (props.product === 'powershell' && nativeSessionRaw.value) {
    tabs.push({ id: 'native' as const, label: 'Windows 原生快照', icon: '🪟' });
  }
  return tabs;
});

// Copy button with feedback
const copiedTarget = ref<string | null>(null);
function copyText(text: string, targetKey: string) {
  if (!text) return;
  navigator.clipboard?.writeText(text).then(() => {
    copiedTarget.value = targetKey;
    setTimeout(() => {
      if (copiedTarget.value === targetKey) copiedTarget.value = null;
    }, 2000);
  }).catch(() => {});
}
</script>

<style scoped>
.docker-tooling-container {
  margin: 1rem 0 2.5rem;
  font-family: inherit;
}

/* Header Bar */
.dt-header-bar {
  margin-bottom: 0.75rem;
}

.dt-badge-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.dt-product-tag {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.15rem 0.55rem;
  border-radius: 6px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.dt-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: var(--vp-c-warning-soft);
  color: var(--vp-c-warning-1);
}

.status-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.dt-status-pill.status-verified {
  background: var(--vp-c-success-soft);
  color: var(--vp-c-success-1);
}

.dt-status-pill.status-unsupported {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
}

.dt-meta-time {
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
  margin-left: auto;
}

.dt-header-note {
  margin: 0.35rem 0 0;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}

/* Compact Spec Strip */
.dt-spec-strip {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  padding: 0.65rem 0.85rem;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.dt-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 1.5rem;
  font-size: 0.8rem;
}

.dt-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.dt-meta-label {
  font-weight: 600;
  color: var(--vp-c-text-2);
  white-space: nowrap;
}

.dt-meta-val {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.dt-img-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  padding: 0.05rem 0.4rem;
  border-radius: 4px;
}

.dt-img-role {
  color: var(--vp-c-text-3);
  font-size: 0.7rem;
  text-transform: capitalize;
}

.dt-img-pill code {
  font-size: 0.75rem;
}

.dt-inline-tool {
  font-size: 0.72rem;
  padding: 0.05rem 0.35rem;
  border-radius: 4px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
}

/* Compact Command Rows */
.dt-cmd-rows {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-top: 0.45rem;
  border-top: 1px dashed var(--vp-c-divider);
}

.dt-cmd-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
  font-size: 0.78rem;
}

.dt-cmd-tag {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--vp-c-text-2);
  white-space: nowrap;
  flex-shrink: 0;
}

.dt-cmd-text {
  flex: 1;
  min-width: 0;
  font-family: var(--vp-font-family-mono);
  font-size: 0.76rem;
  color: var(--vp-c-brand-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dt-mini-copy {
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition: all 0.15s;
}

.dt-mini-copy:hover {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

/* Workbench & Tabs */
.dt-workbench {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}

.dt-tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.4rem 0.6rem 0;
  background: var(--vp-c-bg-elv);
  border-bottom: 1px solid var(--vp-c-divider);
  overflow-x: auto;
}

.dt-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.85rem;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--vp-c-text-2);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.dt-tab-btn:hover {
  color: var(--vp-c-text-1);
}

.dt-tab-btn.active {
  color: var(--vp-c-brand-1);
  border-bottom-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-soft);
  border-radius: 6px 6px 0 0;
}

.dt-tab-count {
  font-size: 0.72rem;
  opacity: 0.75;
}

.dt-tab-panel {
  padding: 0.85rem;
}

/* Terminal Window */
.dt-terminal {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: #18181b;
  color: #f4f4f5;
  overflow: hidden;
  box-shadow: 0 4px 14px rgba(0,0,0,0.12);
}

.dt-terminal-header {
  display: flex;
  align-items: center;
  padding: 0.45rem 0.75rem;
  background: #27272a;
  border-bottom: 1px solid #3f3f46;
}

.dt-window-dots {
  display: flex;
  gap: 5px;
}

.dt-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}

.dt-dot.red { background: #ef4444; }
.dt-dot.yellow { background: #eab308; }
.dt-dot.green { background: #22c55e; }

.dt-terminal-title {
  margin-left: 0.75rem;
  font-size: 0.72rem;
  color: #a1a1aa;
  font-family: var(--vp-font-family-mono);
}

.dt-terminal-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dt-time-badge {
  font-size: 0.7rem;
  color: #e4e4e7;
  background: #3f3f46;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.dt-terminal-copy-btn {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  border: 1px solid #52525b;
  background: #3f3f46;
  color: #e4e4e7;
  cursor: pointer;
  transition: all 0.15s;
}

.dt-terminal-copy-btn:hover {
  background: var(--vp-c-brand-1);
  color: white;
  border-color: var(--vp-c-brand-1);
}

.dt-terminal-content {
  padding: 0.75rem;
  max-height: 28rem;
  overflow: auto;
}

.dt-terminal-pre {
  margin: 0;
  padding: 0;
  font-size: 0.78rem;
  line-height: 1.5;
  font-family: var(--vp-font-family-mono);
  white-space: pre-wrap;
  word-break: break-all;
  background: transparent !important;
}

/* Inventory Styles */
.dt-inventory-box {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dt-inventory-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.dt-search-box {
  position: relative;
  flex: 1;
  min-width: 220px;
}

.dt-search-icon {
  position: absolute;
  left: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75rem;
  pointer-events: none;
}

.dt-search-input {
  width: 100%;
  padding: 0.35rem 1.6rem 0.35rem 1.8rem;
  font-size: 0.8rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  outline: none;
  transition: border-color 0.2s;
}

.dt-search-input:focus {
  border-color: var(--vp-c-brand-1);
}

.dt-clear-search {
  position: absolute;
  right: 0.4rem;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: transparent;
  color: var(--vp-c-text-2);
  cursor: pointer;
  padding: 0.15rem;
}

.dt-view-toggle {
  display: flex;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  overflow: hidden;
}

.dt-toggle-btn {
  padding: 0.28rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  border: none;
  cursor: pointer;
}

.dt-toggle-btn.active {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.dt-env-meta-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.8rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  font-size: 0.75rem;
  color: var(--vp-c-text-1);
}

.dt-env-item strong {
  color: var(--vp-c-text-2);
}

.dt-env-path {
  width: 100%;
  word-break: break-all;
}

.dt-tools-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  max-height: 24rem;
  overflow-y: auto;
  padding: 0.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
}

.dt-tool-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.45rem;
  font-size: 0.72rem;
  font-family: var(--vp-font-family-mono);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  transition: all 0.15s;
}

.dt-tool-chip:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.dt-tool-chip.is-key {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-weight: 700;
}

.dt-key-badge {
  font-size: 0.6rem;
  padding: 0.02rem 0.25rem;
  border-radius: 2px;
  background: var(--vp-c-brand-1);
  color: white;
}

.dt-empty-tools {
  padding: 1.5rem;
  text-align: center;
  color: var(--vp-c-text-2);
  font-size: 0.82rem;
}

/* Assert Styles */
.dt-assert-cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.85rem;
}

.dt-audit-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.dt-audit-icon {
  font-size: 1.15rem;
}

.dt-audit-main {
  flex: 1;
  min-width: 0;
}

.dt-audit-title {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.dt-audit-desc {
  font-size: 0.74rem;
  color: var(--vp-c-text-2);
  margin-top: 0.1rem;
}

.dt-audit-badge {
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  white-space: nowrap;
}

.dt-audit-card.pass .dt-audit-badge {
  background: var(--vp-c-success-soft);
  color: var(--vp-c-success-1);
}

.dt-assert-raw-box {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  overflow: hidden;
}

.dt-assert-raw-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.45rem 0.75rem;
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.dt-copy-btn {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.12rem 0.4rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition: all 0.15s;
}

.dt-copy-btn:hover {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.dt-ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
