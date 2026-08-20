#!/usr/bin/env bash
# hello-mq pulsar/cli-tools：全程只用镜像自带 bin/pulsar-admin、bin/pulsar-client，不引入任何客户端 SDK。
# 六段：bin 列表 → 健康检查 → 建 topic → pulsar-client produce → pulsar-client consume → stats/subscriptions 复查。
# topic 用 non-partitioned（create 不带 -p），后续 stats/subscriptions 命令语义保持一致。
# 独立运行：bash run.sh
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

TOPIC=persistent://public/default/orders-cli
SUB=orders-cli-sub

# step <outfile> <cmd...>：容器内执行，stdout/stderr 合并落 <outfile>。
step() {
  local out="$1"
  shift
  echo "[cli-tools] \$ $*" > "$LAB_DIR/$out"
  compose exec -T pulsar "$@" >> "$LAB_DIR/$out" 2>&1
}

# standalone 冷启动要初始化 BookKeeper ledger 与元数据，给足 180s。
compose up -d --wait --wait-timeout 180

step bin-list.out.txt ls /pulsar/bin
step status.out.txt bin/pulsar-admin brokers healthcheck
step create.out.txt bin/pulsar-admin topics create "$TOPIC"
# topics stats 建 topic 后才有意义：追加进 status 快照（实测 JSON 含 msgInCounter/msgBacklog 等字段）。
echo "[cli-tools] \$ bin/pulsar-admin topics stats $TOPIC" >> "$LAB_DIR/status.out.txt"
compose exec -T pulsar bin/pulsar-admin topics stats "$TOPIC" >> "$LAB_DIR/status.out.txt" 2>&1
# -m 逗号分隔实测会拆成 3 条消息（日志尾部出现 "3 messages successfully produced"）。
step produce.out.txt bin/pulsar-client produce -m "order-cli-1,order-cli-2,order-cli-3" "$TOPIC"
# consume 收满 -n 3 条后自动退出（实测 exit=0，无需 --timeout）；仍用 timeout 兜底防止收不满时前台阻塞。
# timeout 杀掉（rc=124）不视为步骤失败，交由 consumedCount 断言兜底。
step consume.out.txt sh -c "timeout -k 5 120 bin/pulsar-client consume -n 3 -s $SUB \
  --subscription-position Earliest $TOPIC; rc=\$?; if [ \$rc -ne 0 ] && [ \$rc -ne 124 ]; then exit \$rc; fi"
step verify.out.txt sh -c "bin/pulsar-admin topics stats $TOPIC && bin/pulsar-admin topics subscriptions $TOPIC"

assert_eq "binCount" "$(tail -n +2 "$LAB_DIR/bin-list.out.txt" | grep -c .)" 19
assert_eq "healthCheck" "$(grep -c '^ok$' "$LAB_DIR/status.out.txt")" 1
assert_eq "statsAfterCreate" "$(grep -c '"msgInCounter" : 0,' "$LAB_DIR/status.out.txt")" 1
assert_eq "producedMsgCount" "$(grep -oE '[0-9]+ messages successfully produced' "$LAB_DIR/produce.out.txt" | awk '{print $1}' | tail -1)" 3
assert_eq "consumedMsgCount" "$(grep -oE '[0-9]+ messages successfully consumed' "$LAB_DIR/consume.out.txt" | awk '{print $1}' | tail -1)" 3
assert_eq "consumedCount" "$(grep -c 'content:order-cli-' "$LAB_DIR/consume.out.txt")" 3
assert_eq "msgInCounter" "$(sed -n 's/.*"msgInCounter" : \([0-9][0-9]*\),.*/\1/p' "$LAB_DIR/verify.out.txt" | head -1)" 3
assert_eq "msgBacklog" "$(sed -n 's/.*"msgBacklog" : \([0-9][0-9]*\),.*/\1/p' "$LAB_DIR/verify.out.txt" | head -1)" 0
assert_eq "subscriptionListed" "$(grep -c "^$SUB\$" "$LAB_DIR/verify.out.txt")" 1

finish
