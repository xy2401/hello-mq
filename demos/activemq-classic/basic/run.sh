#!/usr/bin/env bash
# activemq-classic/basic：队列自动创建 + 业务落库提交后才 session.commit() + 幂等，发 3 收 3、队列深度归零。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar activemq-classic
compose_up stats
collect_logs producer consumer inspect-db stats

assert_eq "confirmed" "$(count_log producer 'status=confirmed')" 3
assert_eq "received" "$(count_log consumer 'status=received')" 3
assert_eq "uniqueMessageIds" "$(unique_log consumer 'messageId=[^ ]*')" 3
assert_eq "redeliveredCount" "$(count_log consumer 'redelivered=true')" 0
assert_eq "businessCommitted" "$(count_log consumer 'status=business_committed')" 3
assert_eq "business_rows" "$(field_log inspect-db business_rows)" 3
assert_eq "queueDepth" "$(field_log stats queueDepth)" 0
assert_exit consumer 0
finish
