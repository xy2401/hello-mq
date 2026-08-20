#!/usr/bin/env bash
# nats/jetstream-replay：JetStream 持久消费 + 从头回放——replay durable 重收同 3 条，
# 幂等表拦截全部重复，业务行数仍为 3；ACK 不删除消息，流内消息数仍为 3。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar nats
compose_up stats
collect_logs setup producer consumer-first consumer-replay inspect-db stats

first_received="$(count_log consumer-first 'status=received')"
replay_received="$(count_log consumer-replay 'status=received')"
business_rows="$(field_log inspect-db business_rows)"
assert_eq "confirmed" "$(count_log producer 'status=confirmed')" 3
assert_eq "receivedTotal" "$((first_received + replay_received))" 6
assert_eq "uniqueMessageIds" "$(unique_logs 'messageId=[^ ]*' consumer-first consumer-replay)" 3
assert_eq "businessCommitted" "$(count_log consumer-first 'status=business_committed')" 3
assert_eq "duplicatesSkipped" "$(count_log consumer-replay 'status=duplicate_skipped')" 3
assert_eq "duplicatesApplied" "$((business_rows == 3 ? 0 : business_rows - 3))" 0
assert_eq "business_rows" "$business_rows" 3
assert_eq "streamMessagesAfter" "$(field_log stats streamMessages)" 3
assert_exit consumer-replay 0
finish
