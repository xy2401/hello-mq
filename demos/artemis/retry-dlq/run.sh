#!/usr/bin/env bash
# artemis/retry-dlq：毒消息按 address-setting 重投（共 3 次投递、固定 1s 间隔），耗尽转 orders-dlq。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar artemis
compose_up dlq-consumer
collect_logs producer consumer inspect-db dlq-consumer

assert_eq "confirmed" "$(count_log producer 'status=confirmed')" 2
assert_eq "okReceived" "$(count_log consumer 'aggregateId=order-1001.*status=received')" 1
assert_eq "businessCommitted" "$(count_log consumer 'status=business_committed')" 1
assert_eq "business_rows" "$(field_log inspect-db business_rows)" 1
poison_attempts="$(count_log consumer 'status=consume_failed')"
assert_eq "poisonAttempts" "$([ "$poison_attempts" -ge 2 ] && echo true || echo false)" true
assert_eq "poisonMaxAttempt" "$(field_log consumer poisonMaxAttempt)" 3
assert_eq "dlqReceived" "$(count_log dlq-consumer 'status=received')" 1
assert_eq "dlqIsPoison" "$(count_log dlq-consumer 'aggregateId=order-poison.*status=received')" 1
finish
