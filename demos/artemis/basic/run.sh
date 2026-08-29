#!/usr/bin/env bash
# artemis/basic：anycast 队列 + 业务提交后才 acknowledge + 幂等落库，发 3 收 3、队列深度归零。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar artemis
compose_up stats
collect_logs artemis producer consumer inspect-db stats

assert_eq "brokerNioJournal" "$([ "$(count_log artemis 'Using NIO Journal')" -gt 0 ] && echo true || echo false)" true
assert_eq "brokerOrdersDlq" "$([ "$(count_log artemis 'Deploying address orders-dlq')" -gt 0 ] && echo true || echo false)" true
assert_eq "confirmed" "$(count_log producer 'status=confirmed')" 3
assert_eq "received" "$(count_log consumer 'status=received')" 3
assert_eq "uniqueMessageIds" "$(unique_log consumer 'messageId=[^ ]*')" 3
assert_eq "redeliveredCount" "$(count_log consumer 'redelivered=true')" 0
assert_eq "businessCommitted" "$(count_log consumer 'status=business_committed')" 3
assert_eq "business_rows" "$(field_log inspect-db business_rows)" 3
assert_eq "queueDepth" "$(field_log stats queueDepth)" 0
assert_exit consumer 0
finish
