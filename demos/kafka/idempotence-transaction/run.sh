#!/usr/bin/env bash
# kafka/idempotence-transaction：提交事务 3 条对 read_committed 消费者可见，中止事务 2 条不可见，lag 归零。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar kafka
compose_up inspect-db
collect_logs setup producer-commit producer-abort consumer inspect-db

received_total="$(count_log consumer 'status=received')"
assert_eq "txnCommitted" "$(count_log producer-commit 'status=txn_committed')" 1
assert_eq "txnAborted" "$(count_log producer-abort 'status=txn_aborted')" 1
assert_eq "committedVisible" "$received_total" 3
assert_eq "abortedVisible" "$((received_total - 3))" 0
assert_eq "business_rows" "$(field_log inspect-db business_rows)" 3
assert_eq "consumerGroupLag" "$(kafka_group_lag orders-txn-group)" 0
assert_exit consumer 0
finish
