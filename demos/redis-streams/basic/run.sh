#!/usr/bin/env bash
# redis-streams/basic：XADD + Consumer Group + XREADGROUP/XACK + 幂等落库，发 3 收 3；
# XACK 不删除条目，消费后 streamLength 仍为 3、pending 清零。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar redis-streams
compose_up inspect-db
collect_logs setup producer consumer inspect-db

assert_eq "confirmed" "$(count_log producer 'status=confirmed')" 3
assert_eq "received" "$(count_log consumer 'status=received')" 3
assert_eq "uniqueMessageIds" "$(unique_log consumer 'messageId=[^ ]*')" 3
assert_eq "redeliveredCount" "$(count_log consumer 'redelivered=true')" 0
assert_eq "businessCommitted" "$(count_log consumer 'status=business_committed')" 3
assert_eq "duplicatesSkipped" "$(count_log consumer 'status=duplicate_skipped')" 0
assert_eq "business_rows" "$(field_log inspect-db business_rows)" 3
# 关键语义差异：XACK 不从 Stream 删除条目，消费位置记录在 Consumer Group 侧
assert_eq "streamLengthAfter" "$(compose exec -T redis redis-cli XLEN orders.basic)" 3
assert_eq "pendingAfter" "$(compose exec -T redis redis-cli XPENDING orders.basic orders-basic-group | head -n 1)" 0
assert_exit consumer 0
finish
