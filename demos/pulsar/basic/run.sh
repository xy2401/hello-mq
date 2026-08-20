#!/usr/bin/env bash
# pulsar/basic：Exclusive 订阅 + 业务提交后才 ack + 幂等落库，发 3 收 3、积压=0。
# Pulsar 新订阅默认从 Latest 开始：先起 consumer 并等待 status=subscribed，再放行 producer。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

# topic_backlog <topic>：经 pulsar-admin 查 topic 顶层 msgBacklog（取首个匹配，未找到返回 -999）。
topic_backlog() {
  local stats
  stats="$(compose exec -T pulsar bin/pulsar-admin topics stats "persistent://public/default/$1" || true)"
  printf '%s\n' "$stats" | grep -o '"msgBacklog"[[:space:]]*:[[:space:]]*[0-9]*' | head -n 1 | grep -o '[0-9]*$' || printf -- '-999\n'
}

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
compose up -d consumer
wait_subscribed consumer
compose up -d producer
compose wait producer || true
compose wait consumer || true
compose up -d inspect-db
compose wait inspect-db || true
collect_logs setup producer consumer inspect-db

assert_eq "produced" "$(count_log producer 'status=produced')" 3
assert_eq "received" "$(count_log consumer 'status=received')" 3
assert_eq "uniqueMessageIds" "$(unique_log consumer 'messageId=[^ ]*')" 3
assert_eq "businessCommitted" "$(count_log consumer 'status=business_committed')" 3
assert_eq "business_rows" "$(field_log inspect-db business_rows)" 3
assert_eq "topicBacklog" "$(topic_backlog orders-basic)" 0
assert_exit consumer 0
finish
