#!/usr/bin/env bash
# rabbitmq/consumer-crash：业务提交后、ACK 前崩溃（exit 137），重投递被幂等表拦截，业务行数仍为 3。
# 分两阶段：阶段 1 跑到 consumer-run1 崩溃为止，阶段 2 再起 run2/inspect-db。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar rabbitmq
compose up -d consumer-run1
compose wait consumer-run1 || true
replay_checkpoint consumer-crashed-before-ack
compose up -d --no-deps consumer-run2
compose wait consumer-run2 || true
compose up -d --no-deps inspect-db
compose wait inspect-db || true
collect_logs setup producer consumer-run1 consumer-run2 inspect-db

run1_received="$(count_log consumer-run1 'status=received')"
run2_received="$(count_log consumer-run2 'status=received')"
assert_eq "crashExitCode" "$(service_exit_code consumer-run1)" 137
assert_eq "crashAfterBusinessCommit" "$(count_log consumer-run1 'status=business_committed')" 1
assert_eq "receivedTotal" "$((run1_received + run2_received))" 4
assert_eq "redeliveredCount" "$(count_log consumer-run2 'redelivered=true')" 1
assert_eq "duplicatesObserved" "$(count_log consumer-run2 'status=duplicate_skipped')" 1
assert_eq "uniqueMessageIds" "$(unique_logs 'messageId=[^ ]*' consumer-run1 consumer-run2)" 3
assert_eq "business_rows" "$(field_log inspect-db business_rows)" 3
assert_eq "queueDepthAfter" "$(rabbitmq_queue_depth orders.crash)" 0
replay_checkpoint redelivery-recovered
assert_exit consumer-run2 0
finish
