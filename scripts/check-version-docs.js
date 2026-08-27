import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productsRoot = path.join(root, 'docs', 'products');
const sidebar = fs.readFileSync(path.join(root, 'docs', '.vitepress', 'nav.mjs'), 'utf8');
const failures = [];

for (const entry of fs.readdirSync(productsRoot, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
  const product = entry.name;
  const legacyIndex = path.join(productsRoot, product, 'versions.md');
  if (fs.existsSync(legacyIndex)) failures.push(`${product}: 仍残留旧 versions.md`);
  const versionDir = path.join(productsRoot, product, 'version');
  const indexFile = path.join(versionDir, 'index.md');
  if (!fs.existsSync(indexFile)) { failures.push(`${product}: 缺少 version/index.md`); continue; }
  const index = fs.readFileSync(indexFile, 'utf8').replace(/\r\n/g, '\n');
  const pages = fs.readdirSync(versionDir).filter(name => name.endsWith('.md') && name !== 'index.md');
  if (!pages.length) failures.push(`${product}: version 目录没有独立版本页`);
  for (const name of pages) {
    const slug = name.slice(0, -3);
    const route = `/products/${product}/version/${slug}`;
    const content = fs.readFileSync(path.join(versionDir, name), 'utf8').replace(/\r\n/g, '\n');
    if (!index.includes(`](./${slug})`)) failures.push(`${product}: 总览未引用 ${name}`);
    if (!sidebar.includes(route)) failures.push(`${product}: 侧栏未引用 ${route}`);
    if (!/官方/.test(content)) failures.push(`${product}/${name}: 缺少官方资料`);
    if (!/https:\/\//.test(content)) failures.push(`${product}/${name}: 缺少官方来源链接`);
    if (!/发布时间|发布日期|标准时间|标准状态|覆盖时期|发布信息/.test(content)) failures.push(`${product}/${name}: 缺少版本或发布时间信息`);
    if (!/迁移/.test(content)) failures.push(`${product}/${name}: 缺少迁移影响`);
    if (!/资料核对日期：2026-08-27/.test(content)) failures.push(`${product}/${name}: 缺少统一核对日期`);
  }
}

if (failures.length) { console.error(failures.map(item => `❌ ${item}`).join('\n')); process.exit(1); }
console.log('版本资料检查通过。');
