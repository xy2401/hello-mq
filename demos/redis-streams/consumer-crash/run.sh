#!/usr/bin/env bash
# redis-streams/consumer-crash：业务提交后、XACK 前崩溃（exit 137），条目滞留 PEL；
# XCLAIM 移交新消费者，重投递被幂等表拦截，业务行数仍为 3。
# 分两阶段：阶段 1 跑到 consumer-run1 崩溃为止并核对 PEL，阶段 2 再起 run2/inspect-db。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar redis-streams
compose up -d consumer-run1
compose wait consumer-run1 || true
assert_eq "pendingAfterCrash" "$(compose exec -T redis redis-cli XPENDING orders.crash orders-crash-group | head -n 1)" 1
replay_checkpoint pending-after-crash

compose up -d
compose wait inspect-db || true
collect_logs setup producer consumer-run1 consumer-run2 inspect-db

run1_received="$(count_log consumer-run1 'status=received')"
run2_received="$(count_log consumer-run2 'status=received')"
business_rows="$(field_log inspect-db business_rows)"
duplicates_applied=0
if [ "$business_rows" != "3" ]; then
  duplicates_applied=$((business_rows - 3))
fi

assert_eq "crashExitCode" "$(service_exit_code consumer-run1)" 137
assert_eq "crashAfterBusinessCommit" "$(count_log consumer-run1 'status=business_committed')" 1
assert_eq "receivedTotal" "$((run1_received + run2_received))" 4
assert_eq "redeliveredCount" "$(count_log consumer-run2 'redelivered=true')" 1
assert_eq "duplicatesObserved" "$(count_log consumer-run2 'status=duplicate_skipped')" 1
assert_eq "duplicatesApplied" "$duplicates_applied" 0
assert_eq "uniqueMessageIds" "$(unique_logs 'messageId=[^ ]*' consumer-run1 consumer-run2)" 3
assert_eq "business_rows" "$business_rows" 3
assert_eq "streamLengthAfter" "$(compose exec -T redis redis-cli XLEN orders.crash)" 3
assert_eq "pendingAfter" "$(compose exec -T redis redis-cli XPENDING orders.crash orders-crash-group | head -n 1)" 0
replay_checkpoint pending-claimed-and-acked
assert_exit consumer-run2 0
finish
