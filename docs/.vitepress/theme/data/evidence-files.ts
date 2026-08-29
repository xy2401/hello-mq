import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

export function normalizeEvidenceText(value: string) {
  return value.replace(/\r\n?/g, '\n')
}

export function readEvidenceText(file: string) {
  return normalizeEvidenceText(fs.readFileSync(file, 'utf8'))
}
