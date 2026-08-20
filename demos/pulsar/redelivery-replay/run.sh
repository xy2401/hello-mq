#!/usr/bin/env bash
# pulsar/redelivery-replay：毒消息 negativeAck 重投达 maxRedeliver=2 后进 DLQ，正常消息业务提交；
# reset-cursor 到 earliest 后全量回放 2 条。
# Pulsar 新订阅默认从 Latest 开始：先起主消费者与 DLQ 消费者并等待 status=subscribed 再生产；
# 回放消费者在 reset-cursor 之后启动，由分阶段编排保证。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

# wait_subscribed <svc>：新订阅默认从 Latest 开始，必须确认消费者完成订阅后再生产。
wait_subscribed() {
  local svc="$1" i
  for i in $(seq 1 90); do
    if compose logs --no-color --no-log-prefix "$svc" 2>/dev/null | grep -q 'status=subscribed'; then
      return 0
    fi
    sleep 1
  done
  echo "wait_subscribed: 等待 $svc 完成订阅超时" >&2
  return 1
}

ensure_jar pulsar
compose up -d consumer consumer-dlq
wait_subscribed consumer
wait_subscribed consumer-dlq
compose up -d producer
compose wait producer || true
compose wait consumer consumer-dlq || true
collect_logs setup producer consumer consumer-dlq

assert_eq "produced" "$(count_log producer 'status=produced')" 2
assert_eq "businessCommitted" "$(count_log consumer 'status=business_committed')" 1
assert_eq "redeliverRequested" "$([ "$(count_log consumer 'status=redeliver_requested')" -ge 2 ] && echo true || echo false)" true
assert_exit consumer 0
assert_eq "dlqReceived" "$(count_log consumer-dlq 'status=received')" 1
assert_eq "dlqIsPoison" "$(count_log consumer-dlq 'aggregateId=order-poison.*status=received')" 1

# reset-cursor 到 earliest 后全量回放：回放消费者用新库 + --no-business，只收不写库。
compose exec -T pulsar bin/pulsar-admin topics reset-cursor persistent://public/default/orders-redelivery \
  --subscription orders-redeliver-sub --message-id earliest
compose up -d consumer-replay
compose wait consumer-replay || true
collect_logs consumer-replay
assert_eq "replayReceived" "$(count_log consumer-replay 'status=received')" 2
assert_eq "replayUniqueMessageIds" "$(unique_log consumer-replay 'messageId=[^ ]*')" 2
finish
