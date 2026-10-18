export interface CaptureFile extends Record<string, unknown> {
  path: string; type: string; origin: string; permissions: string; permissionsOctal: string;
  uid: number; gid: number; user: string | null; group: string | null; sizeBytes: string; sha256: string | null;
}
export interface CommandEntry { id: string; name: string; path: string | null; realPath?: string; purpose: string; category: string; verified: boolean; }
export interface CommandStep { id: string; argv: string[]; status: string; stdout: string | null; stderr: string | null; exitCode: number | null; result?: unknown; parseError?: string; assertions?: unknown[]; }
export interface CommandExample { id: string; title: string; notes: string[]; status: string; steps: CommandStep[]; }
export interface FileDirectory { path: string; count: number; chunks: string[]; }
export interface Difference { path: string; transition: string; change: string; fields: string[]; before: CaptureFile | null; after: CaptureFile | null; }
export interface DisplayManifest {
  schemaVersion: number; product: { id: string; name: string; version: string };
  capture: { id: string; status: string; execution?: string; sourceSha: string | null; capturedAt: string | null; workflowUrl: string | null; base: { image: string }; recipeSha256: string; errors?: string[]; };
  catalog: string; examples: string; fileIndex: string; diffIndex: string;
  artifacts: Record<string, { sha256: string; sizeBytes: number }>;
}
export interface DisplayPayload { schemaVersion: number; captureId: string; [key: string]: unknown; }
export const statusLabels: Record<string, string> = { pending: '待采集', passed: '通过', partial: '部分完成', failed: '失败', 'not-run': '未执行' };
export const originLabels: Record<string, string> = { product: '目标软件', dependency: '依赖', system: '基础系统', unconfirmed: '未确认' };

export function shellCommand(argv: string[]): string {
  return argv.map(argument => /^[A-Za-z0-9_./:=+,@%-]+$/.test(argument) ? argument : "'" + argument.replaceAll("'", "'\\''") + "'").join(' ');
}
export function formatBytes(value: string | number | null): string {
  if (value === null || value === undefined) return '—';
  const size = Number(value);
  return size < 1024 ? `${value} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KiB` : `${(size / 1024 / 1024).toFixed(1)} MiB`;
}
export function resultTable(value: unknown): { columns: string[]; rows: unknown[][] } {
  const rows = Array.isArray(value) ? value : [value];
  const isObject = (item: unknown): item is Record<string, unknown> => item !== null && typeof item === 'object' && !Array.isArray(item);
  const fields = [...new Set(rows.flatMap(item => isObject(item) ? Object.keys(item) : []))];
  const extra = rows.some(item => !isObject(item)) || (!fields.length && rows.length > 0);
  return { columns: [...fields, ...(extra ? ['值'] : [])], rows: rows.map(item => [...fields.map(key => isObject(item) && Object.hasOwn(item, key) ? item[key] : undefined), ...(extra ? [!fields.length || !isObject(item) ? item : undefined] : [])]) };
}
export function cell(value: unknown): string { return value === undefined ? '—' : typeof value === 'string' ? value || '""' : JSON.stringify(value); }

export async function checkedJson(url: string, signal: AbortSignal, expected?: { sha256: string; sizeBytes?: number }): Promise<unknown> {
  const response = await fetch(url, { signal, cache: 'no-cache' });
  if (!response.ok) throw new Error(`数据请求失败（HTTP ${response.status}）。`);
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('服务器没有返回 JSON，无法读取采集数据。');
  const bytes = await response.arrayBuffer();
  if (expected) {
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(value => value.toString(16).padStart(2, '0')).join('');
    if (digest !== expected.sha256 || (expected.sizeBytes !== undefined && bytes.byteLength !== expected.sizeBytes)) throw new Error('数据校验失败：文件哈希或大小不符，请重新导入同一批次展示包。');
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
export function payload(value: unknown, captureId: string): DisplayPayload {
  const data = value as DisplayPayload;
  if (!data || data.schemaVersion !== 1 || data.captureId !== captureId) throw new Error('数据协议不兼容或混入了其他采集批次。');
  return data;
}
export function artifactUrl(manifestUrl: string, manifest: DisplayManifest, name: string): string {
  if (!manifest.artifacts[name] || name.includes('\\') || name.split('/').some(item => item === '..' || item === '.') || !name.startsWith(`runs/${manifest.capture.id}/`)) throw new Error('无效的展示包分块地址。');
  const url = new URL(name, new URL(manifestUrl, location.href));
  if (url.origin !== location.origin) throw new Error('展示数据必须来自本站。');
  return url.href;
}
