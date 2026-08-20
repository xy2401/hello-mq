#!/usr/bin/env bash
# hello-mq nats/cli-tools：nats:2.11.5 官方镜像是 distroless，仅含 /nats-server 单一二进制，
# 无 shell、无任何收发 CLI（nats CLI 由 nats-io/natscli 独立发行）。本实验如实记录这一缺口：
# 三段：bin 盘点（--version/--help 直执唯一二进制）→ 宿主机监控端点体检（healthz/varz/connz/subsz）
# → produce/consume 无自带 CLI，缺口落 gap.out.txt（收发需外部客户端，Java 实验见 core-pubsub）。
# 独立运行：bash run.sh
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

MON=http://127.0.0.1:8222

# distroless 镜像没有 wget/sh，无法内置 healthcheck；up --wait 容器 running 即返回，
# 就绪判定改由宿主机轮询 /healthz 完成。
compose up -d --wait --wait-timeout 60
for _ in $(seq 1 30); do
  if curl -fsS "$MON/healthz" >/dev/null 2>&1; then break; fi
  sleep 1
done

# bin-list：镜像为 distroless，仅含 /nats-server 单一二进制（无 ls、无 sh 可列目录），
# 故直接执行唯一二进制盘点版本与能力。
{
  echo "# nats:2.11.5 官方镜像为 distroless：文件系统仅含 /nats-server 单一二进制（无 shell、无其他 CLI），故无 bin 目录可列"
  echo "[cli-tools] \$ compose exec nats /nats-server --version"
} > "$LAB_DIR/bin-list.out.txt"
compose exec -T nats /nats-server --version >> "$LAB_DIR/bin-list.out.txt" 2>&1
echo "[cli-tools] \$ compose exec nats /nats-server --help" >> "$LAB_DIR/bin-list.out.txt"
compose exec -T nats /nats-server --help >> "$LAB_DIR/bin-list.out.txt" 2>&1

# status：宿主机直连监控端口，四个端点分开落文件便于 jq 断言。
curl_step() {
  local out="$1" path="$2"
  echo "[cli-tools] \$ curl -fsS $MON$path" > "$LAB_DIR/$out"
  curl -fsS "$MON$path" >> "$LAB_DIR/$out"
  echo >> "$LAB_DIR/$out"
}
curl_step status.out.txt /healthz
curl_step varz.out.txt /varz
curl_step connz.out.txt /connz
curl_step subsz.out.txt /subsz

# produce/consume：镜像不含任何收发 CLI——如实记录缺口，并附一次容器内寻找 nats 二进制的实测证据。
{
  echo "# 缺口记录：nats 官方镜像不含 nats CLI（由 nats-io/natscli 独立发行），distroless 镜像连 shell 都没有，"
  echo "# 纯镜像自带命令无法收发消息；收发需外部客户端（Java 实验见 demos/nats/core-pubsub）。"
  echo "[cli-tools] \$ compose exec nats nats --version   # 尝试在容器内寻找自带 CLI，预期失败"
  compose exec -T nats nats --version 2>&1 || echo "exit=$?（预期失败：镜像不含 nats 二进制）"
} > "$LAB_DIR/gap.out.txt"

# json_body <outfile>：跳过首行命令注释，输出纯 JSON 供 jq 断言。
json_body() { tail -n +2 "$LAB_DIR/$1"; }

assert_eq "binVersion" "$(grep -c 'nats-server: v2\.11\.5' "$LAB_DIR/bin-list.out.txt")" 1
assert_eq "healthzOk" "$(json_body status.out.txt | jq -r .status)" ok
assert_eq "varzVersion" "$(json_body varz.out.txt | jq -r .version)" 2.11.5
assert_eq "varzHasServerId" "$(json_body varz.out.txt | jq '.server_id | length > 0')" true
assert_eq "varzJetstream" "$(json_body varz.out.txt | jq 'has("jetstream")')" true
assert_eq "connzConnections" "$(json_body connz.out.txt | jq -r .num_connections)" 0
assert_eq "subszParsed" "$(json_body subsz.out.txt | jq '.num_subscriptions >= 0')" true
assert_eq "gapRecorded" "$(grep -c '不含 nats CLI' "$LAB_DIR/gap.out.txt")" 1
assert_eq "gapEvidence" "$(grep -c 'executable file not found' "$LAB_DIR/gap.out.txt")" 1

finish
