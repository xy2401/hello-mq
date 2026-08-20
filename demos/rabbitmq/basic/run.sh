#!/usr/bin/env bash
# rabbitmq/basic：durable 队列 + Publisher Confirms + 手动 ACK + 幂等落库，发 3 收 3。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar rabbitmq
compose_up inspect-db
collect_logs setup producer consumer inspect-db

assert_eq "confirmed" "$(count_log producer 'status=confirmed')" 3
assert_eq "received" "$(count_log consumer 'status=received')" 3
assert_eq "uniqueMessageIds" "$(unique_log consumer 'messageId=[^ ]*')" 3
assert_eq "redeliveredCount" "$(count_log consumer 'redelivered=true')" 0
assert_eq "businessCommitted" "$(count_log consumer 'status=business_committed')" 3
assert_eq "duplicatesSkipped" "$(count_log consumer 'status=duplicate_skipped')" 0
assert_eq "business_rows" "$(field_log inspect-db business_rows)" 3
assert_eq "queueDepthAfter" "$(rabbitmq_queue_depth orders.basic)" 0
assert_exit consumer 0
finish
