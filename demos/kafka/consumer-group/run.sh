#!/usr/bin/env bash
# kafka/consumer-group：同组 a-1/a-2 瓜分分区（合计收 3、无重复），独立组 b-1 再次全量接收 3 条。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar kafka
compose_up inspect-db-b
collect_logs setup producer consumer-a-1 consumer-a-2 consumer-b-1 inspect-db-b

assert_eq "produced" "$(count_log producer 'status=produced')" 3
a1_received="$(count_log consumer-a-1 'status=received')"
a2_received="$(count_log consumer-a-2 'status=received')"
assert_eq "groupAReceived" "$((a1_received + a2_received))" 3
assert_eq "groupAUnique" "$(unique_logs 'messageId=[^ ]*' consumer-a-1 consumer-a-2)" 3
assert_eq "a1Assigned" "$(( $(count_log consumer-a-1 'partitions=[0-9]') > 0 ))" 1
assert_eq "a2Assigned" "$(( $(count_log consumer-a-2 'partitions=[0-9]') > 0 ))" 1
assert_exit consumer-a-1 0
assert_exit consumer-a-2 0
assert_eq "groupBReceived" "$(count_log consumer-b-1 'status=received')" 3
assert_eq "groupBBusinessRows" "$(field_log inspect-db-b business_rows)" 3
assert_eq "groupALag" "$(kafka_group_lag orders-group-a)" 0
finish
