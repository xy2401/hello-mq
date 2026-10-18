<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { withBase } from 'vitepress';
import { artifactUrl, cell, checkedJson, formatBytes, originLabels, payload, resultTable, shellCommand, statusLabels, type CaptureFile, type CommandEntry, type CommandExample, type Difference, type DisplayManifest, type FileDirectory } from './data';

const props = defineProps<{ dataUrl: string; mode: 'catalog' | 'examples' }>();
const manifest = shallowRef<DisplayManifest>();
const commands = shallowRef<CommandEntry[]>([]);
const examples = shallowRef<CommandExample[]>([]);
const directories = shallowRef<FileDirectory[]>([]);
const differences = shallowRef<Difference[]>([]);
const files = shallowRef<CaptureFile[]>([]);
const diffChunks = ref<string[]>([]);
const fileTotal = ref(0), diffTotal = ref(0);
const loading = ref(true), detailLoading = ref(false), error = ref(''), detailError = ref('');
const tab = ref('commands'), search = ref(''), origin = ref(''), directory = ref('/'), diffChunk = ref(0), page = ref(1);
const exampleId = ref(''), stepId = ref(''), outputView = ref('stdout'), message = ref('');
const selectedDetail = shallowRef<unknown>();
const dataRevision = ref<string | null>(null);
let request: AbortController | undefined;
let generation = 0;
let mounted = false;
const size = 50;
const url = computed(() => withBase(props.dataUrl));
const pending = computed(() => manifest.value?.capture.status === 'pending');
const example = computed(() => examples.value.find(item => item.id === exampleId.value));
const step = computed(() => example.value?.steps.find(item => item.id === stepId.value));
const structured = computed(() => !!step.value && Object.hasOwn(step.value, 'result'));
const table = computed(() => resultTable(step.value?.result));
const pretty = (value: unknown) => JSON.stringify(value, null, 2);
const filtered = computed(() => {
  const needle = search.value.trim().toLowerCase();
  if (tab.value === 'commands') return commands.value.filter(item => !needle || `${item.name} ${item.path} ${item.purpose} ${item.category}`.toLowerCase().includes(needle));
  if (tab.value === 'files') return files.value.filter(item => (!origin.value || item.origin === origin.value) && (!needle || item.path.toLowerCase().includes(needle)));
  return differences.value.filter(item => !needle || `${item.path} ${item.transition} ${item.change}`.toLowerCase().includes(needle));
});
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / size)));
const shown = computed(() => filtered.value.slice((page.value - 1) * size, page.value * size));

async function read(name: string) {
  const current = manifest.value!;
  return payload(await checkedJson(artifactUrl(url.value, current, name), request!.signal, current.artifacts[name]), current.capture.id);
}
async function loadDetails() {
  if (!manifest.value || props.mode !== 'catalog' || tab.value === 'commands') return;
  const current = ++generation;
  detailLoading.value = true; detailError.value = ''; selectedDetail.value = undefined;
  try {
    if (tab.value === 'files') {
      const entry = directories.value.find(item => item.path === directory.value);
      const chunks = await Promise.all((entry?.chunks ?? []).map(read));
      if (current === generation) files.value = chunks.flatMap(chunk => chunk.files as CaptureFile[]);
    } else {
      const chunk = diffChunks.value[diffChunk.value];
      const data = chunk ? await read(chunk) : null;
      if (current === generation) differences.value = data ? data.changes as Difference[] : [];
    }
  } catch (cause) { if (current === generation) detailError.value = cause instanceof Error ? cause.message : '分块读取失败。'; }
  finally { if (current === generation) detailLoading.value = false; }
}
async function load() {
  request?.abort(); request = new AbortController(); generation++;
  const current = request;
  loading.value = true; error.value = ''; manifest.value = undefined;
  try {
    const lockUrl = new URL('import-lock.json', new URL(url.value, location.href)).href;
    const lock = await checkedJson(lockUrl, current.signal) as { captureId: string; manifestSha256: string; manifestFile?: string; product: string; dataRevision?: string | null };
    if (!/^[a-z0-9-]{1,100}$/.test(lock.captureId) || (lock.manifestFile && lock.manifestFile !== `runs/${lock.captureId}/manifest.json`)) throw new Error('导入锁包含无效的清单地址。');
    const manifestUrl = lock.manifestFile ? new URL(lock.manifestFile, new URL(url.value, location.href)).href : url.value;
    const data = await checkedJson(manifestUrl, current.signal, { sha256: lock.manifestSha256 }) as DisplayManifest;
    if (current !== request || current.signal.aborted) return;
    if (data.schemaVersion !== 1 || data.capture?.id !== lock.captureId || data.product?.id !== lock.product || !['pending', 'passed', 'partial', 'failed'].includes(data.capture.status)) throw new Error('展示包与导入锁不一致。');
    manifest.value = data;
    dataRevision.value = lock.dataRevision && /^[a-f0-9]{40}$/.test(lock.dataRevision) ? lock.dataRevision : null;
    const [catalog, cases, index, diff] = await Promise.all([read(data.catalog), read(data.examples), read(data.fileIndex), read(data.diffIndex)]);
    if (current !== request || current.signal.aborted) return;
    commands.value = (pending.value ? catalog.plannedCommands : catalog.commands) as CommandEntry[];
    examples.value = cases.examples as CommandExample[];
    directories.value = index.directories as FileDirectory[]; fileTotal.value = index.total as number;
    diffChunks.value = diff.chunks as string[]; diffTotal.value = diff.total as number;
    exampleId.value = examples.value[0]?.id ?? ''; directory.value = directories.value[0]?.path ?? '/';
    await loadDetails();
  } catch (cause) { if (current === request && !current.signal.aborted) error.value = cause instanceof Error ? cause.message : '采集数据读取失败。'; }
  finally { if (current === request) loading.value = false; }
}
async function copy(value: string) {
  try { await navigator.clipboard.writeText(value); message.value = '已复制。'; }
  catch { message.value = '复制失败，可直接选择文本复制。'; }
}
watch(example, value => { stepId.value = value?.steps[0]?.id ?? ''; });
watch(step, () => { outputView.value = 'stdout'; message.value = ''; });
watch([tab, directory, diffChunk], () => { page.value = 1; search.value = ''; if (mounted) void loadDetails(); });
watch([search, origin], () => { page.value = 1; });
watch(() => props.dataUrl, () => { if (mounted) void load(); });
onMounted(() => { mounted = true; void load(); });
onBeforeUnmount(() => { mounted = false; request?.abort(); generation++; });
</script>

<template>
  <ClientOnly>
    <section class="dc" aria-label="容器命令与完整文件记录">
      <p v-if="loading" class="dc-empty" role="status">读取采集数据…</p>
      <div v-else-if="error" class="dc-error" role="alert">{{ error }} <button @click="load">重新读取</button></div>
      <template v-else-if="manifest">
        <header class="dc-heading"><strong>{{ manifest.product.name }} <span>{{ manifest.product.version }}</span></strong><span :class="`dc-status-${manifest.capture.status}`">{{ statusLabels[manifest.capture.status] }}</span></header>
        <p v-if="manifest.capture.execution === 'fixture'" class="dc-notice">界面测试夹具：仅验证分页、筛选与状态显示，不是真实容器采集结果，禁止发布为证据。</p>
        <p v-else-if="pending" class="dc-notice">配方已就绪，尚未运行新环境采集。下方为计划命令和案例，不代表已有执行结果。</p>
        <p v-else-if="manifest.capture.status !== 'passed'" class="dc-notice">本批次未全部通过；请查看原始记录与失败信息。</p>
        <template v-if="mode === 'catalog'">
          <div class="dc-toolbar"><div class="dc-tabs" role="group" aria-label="目录视图"><button v-for="item in [['commands','命令目录'],['files','文件清单'],['diff','安装差异']]" :key="item[0]" :aria-pressed="tab === item[0]" @click="tab = item[0]">{{ item[1] }}</button></div><input v-model="search" type="search" :aria-label="tab === 'commands' ? '搜索命令' : tab === 'files' ? '过滤当前目录' : '过滤当前差异分块'" :placeholder="tab === 'commands' ? '搜索命令、用途' : tab === 'files' ? '过滤当前目录' : '过滤当前差异分块'" /></div>
          <div v-if="tab === 'files'" class="dc-toolbar"><label>目录 <select v-model="directory" aria-label="文件目录" :disabled="!directories.length"><option v-if="!directories.length" value="/">尚无文件清单</option><option v-for="item in directories" :key="item.path" :value="item.path">{{ item.path }} · {{ item.count }}</option></select></label><label>归属 <select v-model="origin" aria-label="文件归属"><option value="">全部</option><option v-for="(label, key) in originLabels" :key="key" :value="key">{{ label }}</option></select></label><span>共 {{ fileTotal }} 个路径 · 仅加载所选目录</span></div>
          <div v-if="tab === 'diff'" class="dc-toolbar"><label>分块 <select v-model="diffChunk" aria-label="差异分块" :disabled="!diffChunks.length"><option v-if="!diffChunks.length" :value="0">尚无差异</option><option v-for="(_, index) in diffChunks" :key="index" :value="index">{{ index + 1 }} / {{ diffChunks.length }}</option></select></label><span>共 {{ diffTotal }} 项变化；详情包含前后记录</span></div>
          <p v-if="detailLoading" class="dc-empty" role="status">读取所选分块…</p>
          <p v-else-if="detailError" class="dc-error" role="alert">{{ detailError }} <button @click="loadDetails">重试</button></p>
          <template v-else>
            <div v-if="shown.length" class="dc-scroll" tabindex="0" aria-label="目录表格，可横向滚动"><table>
              <thead><tr v-if="tab === 'commands'"><th>命令</th><th>分类</th><th>用途</th><th>来源</th></tr><tr v-else-if="tab === 'files'"><th>路径</th><th>权限</th><th>属主</th><th>大小</th><th>归属</th><th>详情</th></tr><tr v-else><th>路径</th><th>阶段</th><th>变化</th><th>详情</th></tr></thead>
              <tbody v-if="tab === 'commands'"><tr v-for="item in shown as CommandEntry[]" :key="item.id"><td><code>{{ item.name }}</code></td><td>{{ item.category }}</td><td>{{ item.purpose }}</td><td><button v-if="item.verified" @click="selectedDetail = item">文件证明</button><span v-else>计划，待采集</span></td></tr></tbody>
              <tbody v-else-if="tab === 'files'"><tr v-for="item in shown as CaptureFile[]" :key="item.path"><td><code :title="item.path">{{ item.path }}</code><small>{{ item.type }}</small></td><td><code>{{ item.permissions }}<br />{{ item.permissionsOctal }}</code></td><td>{{ item.user ?? item.uid }}:{{ item.group ?? item.gid }}</td><td :title="`${item.sizeBytes} bytes`">{{ formatBytes(item.sizeBytes) }}</td><td>{{ originLabels[item.origin] }}</td><td><button @click="selectedDetail = item">元数据</button></td></tr></tbody>
              <tbody v-else><tr v-for="item in shown as Difference[]" :key="`${item.transition}:${item.path}`"><td><code>{{ item.path }}</code></td><td>{{ item.transition === 'base-to-dependencies' ? '系统 → 依赖' : '依赖 → 软件' }}</td><td>{{ ({ added:'新增', removed:'删除', modified:'修改', 'timestamp-only':'仅时间' } as Record<string,string>)[item.change] }}</td><td><button @click="selectedDetail = item">前后对比</button></td></tr></tbody>
            </table></div>
            <p v-else class="dc-empty">{{ pending ? '等待完整采集后生成文件清单和安装差异。' : '没有匹配的记录。' }}</p>
            <div v-if="pageCount > 1" class="dc-pagination"><button :disabled="page === 1" @click="page--">上一页</button><span aria-live="polite">{{ page }} / {{ pageCount }} · {{ filtered.length }} 项，每页 50 项</span><button :disabled="page === pageCount" @click="page++">下一页</button></div>
            <div v-if="selectedDetail" class="dc-detail"><div class="dc-bar"><strong>完整记录</strong><button @click="selectedDetail = undefined">收起</button></div><pre>{{ pretty(selectedDetail) }}</pre></div>
          </template>
        </template>
        <template v-else>
          <div class="dc-toolbar"><label>案例 <select v-model="exampleId" aria-label="命令案例"><option v-for="item in examples" :key="item.id" :value="item.id">{{ item.title }} · {{ statusLabels[item.status] }}</option></select></label><label v-if="example">步骤 <select v-model="stepId" aria-label="执行步骤"><option v-for="item in example.steps" :key="item.id" :value="item.id">{{ item.id }} · {{ statusLabels[item.status] }}</option></select></label></div>
          <template v-if="step && example">
            <div class="dc-bar"><strong>命令 <small>Shell · /work</small></strong><button @click="copy(shellCommand(step.argv))">复制命令</button></div>
            <pre class="dc-command"><code>{{ shellCommand(step.argv) }}</code></pre>
            <div class="dc-notes"><strong>备注</strong><span>{{ example.notes.join(' ') }}</span></div>
            <div class="dc-bar"><strong>执行结果 <small>{{ statusLabels[step.status] }} · {{ step.exitCode === null ? '尚无退出码' : `退出码 ${step.exitCode}` }}</small></strong><div class="dc-tabs" role="group" aria-label="输出视图"><button :aria-pressed="outputView === 'stdout'" @click="outputView = 'stdout'">stdout</button><button :aria-pressed="outputView === 'stderr'" @click="outputView = 'stderr'">stderr</button><template v-if="structured"><button :aria-pressed="outputView === 'table'" @click="outputView = 'table'">表格</button><button :aria-pressed="outputView === 'json'" @click="outputView = 'json'">JSON</button></template></div></div>
            <p v-if="step.status === 'not-run'" class="dc-empty">此步骤尚未采集，没有可展示的执行结果。</p>
            <div v-else-if="outputView === 'table'" class="dc-scroll"><table><thead><tr><th v-for="(column,index) in table.columns" :key="index">{{ column }}</th></tr></thead><tbody><tr v-for="(row,index) in table.rows.slice(0,50)" :key="index"><td v-for="(value,columnIndex) in row" :key="columnIndex"><code>{{ cell(value) }}</code></td></tr></tbody></table><p v-if="table.rows.length > 50">表格显示前 50 行，完整内容见 JSON。</p></div>
            <pre v-else-if="outputView === 'json'">{{ pretty(step.result) }}</pre>
            <pre v-else>{{ step[outputView === 'stderr' ? 'stderr' : 'stdout'] || `该步骤没有${outputView === 'stderr' ? '标准错误' : '标准输出'}。` }}</pre>
            <details class="dc-source" v-if="step.status !== 'not-run'"><summary>执行记录与断言</summary><pre>{{ pretty(step) }}</pre></details>
          </template>
        </template>
        <p v-if="message" class="dc-message" role="status">{{ message }}</p>
        <details class="dc-source"><summary>采集来源与环境 <span>{{ manifest.capture.id }}</span></summary><p><code>{{ manifest.capture.base.image }}</code></p><p>来源提交：{{ manifest.capture.sourceSha ?? '待 Actions 采集' }}<br />时间：{{ manifest.capture.capturedAt ?? '未采集' }}<br />配方 SHA-256：{{ manifest.capture.recipeSha256 }}</p><p v-if="dataRevision">完整文件清单：<a v-for="stage in ['base','dependencies','software']" :key="stage" :href="`https://raw.githubusercontent.com/xy2401/hello-docker/${dataRevision}/evidence/software/${manifest.product.id}/runs/${manifest.capture.id}/files.${stage}.jsonl`" target="_blank" rel="noopener noreferrer">{{ ({base:'基础系统',dependencies:'依赖阶段',software:'软件阶段'} as Record<string,string>)[stage] }} JSONL · </a></p><p v-if="manifest.capture.workflowUrl"><a :href="manifest.capture.workflowUrl" target="_blank" rel="noopener noreferrer">完整三阶段 JSONL、安装锁和原始记录：Hello Docker 采集产物</a></p><pre v-if="manifest.capture.errors?.length">{{ pretty(manifest.capture.errors) }}</pre></details>
      </template>
    </section>
  </ClientOnly>
</template>

<style scoped>
.dc { margin:12px 0; border:1px solid var(--vp-c-divider); border-radius:8px; overflow:hidden; font-size:12px; background:var(--vp-c-bg); }
.dc-heading,.dc-toolbar,.dc-bar,.dc-pagination { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:7px 12px; }
.dc-heading { background:var(--vp-c-bg-soft); }.dc-heading strong { font-size:14px; }.dc-heading strong span { margin-left:8px; font-size:11px; font-weight:400; color:var(--vp-c-text-2); }
.dc-toolbar,.dc-bar { border-bottom:1px solid var(--vp-c-divider); }.dc-toolbar { flex-wrap:wrap; justify-content:flex-start; }.dc-toolbar>input { flex:1; min-width:150px; }.dc-toolbar>span { color:var(--vp-c-text-2); font-size:11px; }
.dc-tabs { display:flex; align-items:center; gap:4px; flex-shrink:0; }.dc label { display:flex; align-items:center; gap:7px; min-width:0; }.dc label select { max-width:520px; min-width:130px; }
.dc button { border:1px solid var(--vp-c-divider); border-radius:5px; padding:3px 8px; font-size:12px; line-height:1.6; color:var(--vp-c-text-2); background:var(--vp-c-bg); white-space:nowrap; cursor:pointer; }
.dc button:hover:not(:disabled),.dc button[aria-pressed=true] { color:var(--vp-c-brand-1); border-color:var(--vp-c-brand-1); }.dc button[aria-pressed=true] { background:var(--vp-c-brand-soft); }.dc button:disabled { opacity:.4; cursor:default; }
.dc input,.dc select { height:32px; min-width:0; border:1px solid var(--vp-c-divider); border-radius:5px; padding:0 8px; color:var(--vp-c-text-1); background:var(--vp-c-bg); font:inherit; }
.dc :is(button,input,select):focus-visible,.dc-scroll:focus-visible { outline:2px solid var(--vp-c-brand-1); outline-offset:2px; }
.dc-notice { margin:0; padding:7px 12px; border-bottom:1px solid var(--vp-c-divider); color:var(--vp-c-text-2); font-size:12px; line-height:1.65; background:var(--vp-c-warning-soft); }
.dc-status-pending,.dc-status-partial { color:var(--vp-c-warning-1); }.dc-status-passed { color:var(--vp-c-green-1); }.dc-status-failed,.dc-error { color:var(--vp-c-danger-1); }
.dc-scroll { overflow:auto; max-height:470px; }.dc table { display:table; width:100%; margin:0; border-collapse:collapse; font-size:12px; }.dc th,.dc td { border:1px solid var(--vp-c-divider); padding:6px 9px; text-align:left; line-height:1.5; }.dc th { background:var(--vp-c-bg-soft); white-space:nowrap; position:sticky; top:0; }.dc td code { font-size:11px; background:transparent; padding:0; overflow-wrap:anywhere; }.dc td small { display:block; color:var(--vp-c-text-3); font-size:10px; }
.dc pre { margin:0; padding:9px 12px; max-height:300px; overflow:auto; border-radius:0; background:var(--vp-c-bg-alt); color:var(--vp-c-text-1); font:12px/1.6 var(--vp-font-family-mono); }.dc pre code { padding:0; background:transparent; font:inherit; color:inherit; white-space:pre-wrap; overflow-wrap:anywhere; }.dc-command { border-bottom:1px solid var(--vp-c-divider); }
.dc-notes { display:flex; align-items:baseline; gap:10px; padding:6px 12px; border-bottom:1px solid var(--vp-c-divider); color:var(--vp-c-text-2); line-height:1.65; }.dc-notes strong { flex-shrink:0; color:var(--vp-c-text-1); }.dc-bar small { margin-left:8px; color:var(--vp-c-text-2); font-size:11px; font-weight:400; }.dc-bar { flex-wrap:wrap; }.dc-empty { margin:0; padding:18px 12px; color:var(--vp-c-text-2); text-align:center; }.dc-error,.dc-message { margin:0; padding:10px 12px; }
.dc-detail,.dc-source { border-top:1px solid var(--vp-c-divider); }.dc-source { padding:6px 12px; font-size:11px; }.dc-source summary { cursor:pointer; color:var(--vp-c-text-2); overflow-wrap:anywhere; }.dc-source summary span { margin-left:10px; color:var(--vp-c-text-3); }.dc-source p { margin:8px 0; overflow-wrap:anywhere; }.dc-source pre { padding:8px 0; background:transparent; }.dc-source code { overflow-wrap:anywhere; }
:global(.docker-commands-page .VPDoc .container),:global(.docker-commands-page .VPDoc .content),:global(.docker-commands-page .VPDoc .content-container),:global(.VPDoc.docker-commands-page .container),:global(.VPDoc.docker-commands-page .content),:global(.VPDoc.docker-commands-page .content-container) { max-width:none!important; }
@media(max-width:600px) { .dc label { flex:1; }.dc label select { max-width:100%; flex:1; }.dc-heading { align-items:flex-start; }.dc-heading strong span { display:block; margin-left:0; }.dc-toolbar>input { flex-basis:100%; } }
</style>
