#!/usr/bin/env bash
# hello-mq redis-streams/cli-tools：全程只用镜像自带 redis-cli，不引入任何客户端 SDK。
# 六段：bin 列表 → INFO 状态 → XGROUP CREATE（MKSTREAM 顺带建 stream）→ XADD 生产 → XREADGROUP 消费+XACK → XLEN/XPENDING 复查。
# 独立运行：bash run.sh
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

STREAM=orders:cli
GROUP=orders-cli-group
CONSUMER=consumer-1

# step <outfile> <cmd...>：容器内执行，stdout/stderr 合并落 <outfile>。
step() {
  local out="$1"
  shift
  echo "[cli-tools] \$ $*" > "$LAB_DIR/$out"
  compose exec -T redis "$@" >> "$LAB_DIR/$out" 2>&1
}

compose up -d --wait --wait-timeout 120

step bin-list.out.txt sh -c 'ls /usr/local/bin | grep ^redis; redis-cli --version'
# INFO 输出带 CRLF，tr -d '\r' 保证快照可读。
step status.out.txt sh -c 'redis-cli INFO server | tr -d "\r" | grep -E "redis_version|uptime_in_seconds"'
# MKSTREAM：stream 不存在时顺带创建；组起始位点 0 表示从 stream 头部开始投递。
step create.out.txt redis-cli XGROUP CREATE "$STREAM" "$GROUP" 0 MKSTREAM
# '*' 由服务端生成递增 ID；exec 非 tty 下 redis-cli 为 raw 输出，每行一个 ID。
step produce.out.txt sh -c "redis-cli XADD $STREAM '*' payload order-cli-1 \
  && redis-cli XADD $STREAM '*' payload order-cli-2 \
  && redis-cli XADD $STREAM '*' payload order-cli-3"
# 实测坑：XREADGROUP 用 STREAMS <stream> 0 只重放该 consumer 的 pending 条目，
# 首次消费必须用 '>' 才能拿到新消息；消费后 XACK（ID 从 XRANGE 提取），最后再用 0 重放确认 pending 已清空。
step consume.out.txt sh -c "redis-cli XREADGROUP GROUP $GROUP $CONSUMER COUNT 3 STREAMS $STREAM '>' \
  && redis-cli XACK $STREAM $GROUP \$(redis-cli XRANGE $STREAM - + | awk '(NR-1)%3==0') \
  && redis-cli XREADGROUP GROUP $GROUP $CONSUMER COUNT 3 STREAMS $STREAM 0"
step verify.out.txt sh -c "echo \"XLEN=\$(redis-cli XLEN $STREAM)\"; echo \"PENDING=\$(redis-cli XPENDING $STREAM $GROUP | head -1)\""

assert_eq "binCount" "$(grep -cE '^redis-[a-z-]+$' "$LAB_DIR/bin-list.out.txt")" 6
assert_eq "versionLine" "$(grep -c '^redis-cli [0-9]' "$LAB_DIR/bin-list.out.txt")" 1
assert_eq "redisVersion" "$(grep -c '^redis_version:' "$LAB_DIR/status.out.txt")" 1
assert_eq "groupCreated" "$(grep -c '^OK$' "$LAB_DIR/create.out.txt")" 1
assert_eq "xaddCount" "$(grep -cE '^[0-9]+-[0-9]+$' "$LAB_DIR/produce.out.txt")" 3
assert_eq "consumedCount" "$(grep -c '^order-cli-' "$LAB_DIR/consume.out.txt")" 3
assert_eq "xlen" "$(grep -oE '^XLEN=[0-9]+' "$LAB_DIR/verify.out.txt" | cut -d= -f2)" 3
assert_eq "pendingAfterAck" "$(grep -oE '^PENDING=[0-9]+' "$LAB_DIR/verify.out.txt" | cut -d= -f2)" 0

finish
