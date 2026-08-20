#!/usr/bin/env bash
# kafka/basic：acks=all + 幂等生产 + 手动提交 offset + 幂等落库，发 3 收 3，消费组 lag 归零。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar kafka
compose_up inspect-db
collect_logs setup producer consumer inspect-db

assert_eq "produced" "$(count_log producer 'status=produced')" 3
assert_eq "received" "$(count_log consumer 'status=received')" 3
assert_eq "uniqueMessageIds" "$(unique_log consumer 'messageId=[^ ]*')" 3
assert_eq "businessCommitted" "$(count_log consumer 'status=business_committed')" 3
assert_eq "business_rows" "$(field_log inspect-db business_rows)" 3
assert_eq "consumerGroupLag" "$(kafka_group_lag orders-basic-group)" 0
assert_exit consumer 0
finish
