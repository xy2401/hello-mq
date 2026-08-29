#!/usr/bin/env bash
# rabbitmq/backlog-recovery：3 fixture × repeat=2 共 6 条积压在 durable 队列，
# 消费者启动后追赶清零；第二轮与第一轮同 orderId，幂等收敛为 3 条业务写入。
# 阶段 1 只起 producer（度量积压深度），阶段 2 起 consumer/inspect-db。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar rabbitmq
compose up -d rabbitmq
wait_healthy rabbitmq
compose run --rm setup
# 清掉历史残留，保证积压计数只反映本轮生产
compose exec -T rabbitmq rabbitmqctl purge_queue orders.backlog

compose up -d producer
compose wait producer || true
collect_logs producer
assert_eq "confirmed" "$(count_log producer 'status=confirmed')" 6
assert_eq "backlogDepth" "$(rabbitmq_queue_depth orders.backlog)" 6
replay_checkpoint backlog-without-consumer

compose up -d
compose wait inspect-db || true
collect_logs setup producer consumer inspect-db

assert_eq "received" "$(count_log consumer 'status=received')" 6
assert_eq "uniqueMessageIds" "$(unique_log consumer 'messageId=[^ ]*')" 6
assert_eq "businessCommitted" "$(count_log consumer 'status=business_committed')" 3
assert_eq "businessDuplicatesSkipped" "$(count_log consumer 'status=duplicate_skipped')" 3
assert_eq "business_rows" "$(field_log inspect-db business_rows)" 3
assert_eq "queueDepthAfter" "$(rabbitmq_queue_depth orders.backlog)" 0
replay_checkpoint backlog-recovered
assert_exit consumer 0
finish
