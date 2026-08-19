#!/usr/bin/env node
// 轮询 Compose Project 内服务的健康状态，不使用固定长 sleep（规格 §9.4-4）。
// 通过 docker inspect 读取容器自身 healthcheck 状态：不在启动期向容器内 exec
// 任何命令，避免以 root 身份干扰 RabbitMQ 的 .erlang.cookie 初始化。
// 用法：node scripts/wait-for-service.js <compose-project> <compose-file> <service> [timeout-seconds] [env-file]

import { execFileSync } from 'node:child_process'

const [project, composeFile, service, timeoutArg, envFile] = process.argv.slice(2)
if (!project || !composeFile || !service) {
  console.error('usage: wait-for-service.js <compose-project> <compose-file> <service> [timeout-seconds] [env-file]')
  process.exit(2)
}
const timeoutS = Number(timeoutArg ?? 90) || 90
const envArgs = envFile ? ['--env-file', envFile] : []

function composePs() {
  return execFileSync('docker', ['compose', '-p', project, ...envArgs, '-f', composeFile, 'ps', '-q', service], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
}

function healthOf(containerId) {
  const raw = execFileSync(
    'docker',
    ['inspect', '--format', '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}', containerId],
    { encoding: 'utf8' },
  ).trim()
  return raw
}

const deadline = Date.now() + timeoutS * 1000
while (Date.now() < deadline) {
  try {
    const containerId = composePs()
    if (containerId) {
      const status = healthOf(containerId)
      if (status === 'healthy') {
        console.log(`[wait-for-service] ${service} is healthy`)
        process.exit(0)
      }
      if (status === 'exited' || status === 'dead') {
        console.error(`[wait-for-service] ${service} container ${status}; check compose logs`)
        process.exit(1)
      }
    }
  } catch {
    // compose/docker 暂时不可用（容器尚未创建等），继续轮询
  }
  await new Promise((r) => setTimeout(r, 2000))
}
console.error(`[wait-for-service] ${service} not healthy within ${timeoutS}s`)
process.exit(1)
