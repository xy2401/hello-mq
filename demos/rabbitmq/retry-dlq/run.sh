#!/usr/bin/env bash
# rabbitmq/retry-dlq：毒消息 3 次重试后进 DLQ，正常消息 2 条正常落库。
# 前置的 setup + purge 以一次性容器执行：retry 队列必须在首次使用前保持为空，
# 且 purge 需发生在拓扑创建之后、主流程之前，无法用 depends_on 表达。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar rabbitmq
compose up -d rabbitmq
compose wait rabbitmq || true
compose run --rm setup
compose exec -T rabbitmq rabbitmqctl purge_queue orders.work
compose exec -T rabbitmq rabbitmqctl purge_queue orders.retry || true
compose up -d
compose wait inspect-db || true
collect_logs producer consumer inspect-db

assert_eq "confirmed" "$(count_log producer 'status=confirmed')" 3
assert_eq "business_rows" "$(field_log inspect-db business_rows)" 2
# 毒消息（correlationId=order-poison）应恰好重试 1、2、3 次
assert_eq "poisonAttempts" "$({ grep 'correlationId=order-poison' "$LAB_DIR/consumer.out.txt" | grep -o 'attempt=[0-9]*' | cut -d= -f2 | paste -sd, - || true; })" "1,2,3"
assert_eq "poisonMovedToDlq" "$(count_log consumer 'status=poison_to_dlq')" 1
assert_eq "dlqMessages" "$(rabbitmq_queue_depth orders.dlq)" 1
assert_eq "workQueueDepthAfter" "$(rabbitmq_queue_depth orders.work)" 0
assert_eq "retryQueueDepthAfter" "$(rabbitmq_queue_depth orders.retry)" 0
assert_exit consumer 0
finish
