#!/usr/bin/env bash
# pulsar/subscriptions：同一 topic 四类订阅对比——Exclusive 独占（第二个消费者被拒绝）/
# Shared 分摊 / Failover 主备切换 / Key_Shared 同 key 粘连。
# Pulsar 新订阅默认从 Latest 开始：每轮先起消费者并等待 status=subscribed 再生产；
# Exclusive 碰撞窗口与 Failover 提升时机由分阶段编排保证。
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

# gt0 <n>：大于 0 → true（对应 labs.mjs 的 "> 0" 断言）。
gt0() { [ "$1" -gt 0 ] && echo true || echo false; }

ensure_jar pulsar
compose up -d consumer-ex-1
wait_subscribed consumer-ex-1
collect_logs setup

# --- 阶段 1：Exclusive。ex-1 独占消费；ex-2 在 ex-1 在线时加入必须被拒绝（非零退出）。
compose up -d --no-deps producer-exclusive
compose wait producer-exclusive || true
sleep 4
compose up -d --no-deps consumer-ex-2
compose wait consumer-ex-2 || true
ex2_code="$(service_exit_code consumer-ex-2)"
assert_eq "exclusiveSecondConsumerRejected" "$([ "$ex2_code" != "0" ] && echo true || echo false)" true
compose wait consumer-ex-1 || true
collect_logs producer-exclusive consumer-ex-1 consumer-ex-2
assert_eq "produced" "$(count_log producer-exclusive 'status=produced')" 3
assert_eq "exclusiveReceived" "$(count_log consumer-ex-1 'status=received')" 3

# --- 阶段 2：Shared。两个消费者瓜分 3 条消息，每条恰被消费一次。
compose up -d --no-deps consumer-shared-1 consumer-shared-2
wait_subscribed consumer-shared-1
wait_subscribed consumer-shared-2
compose up -d --no-deps producer-shared
compose wait producer-shared || true
compose wait consumer-shared-1 consumer-shared-2 || true
collect_logs consumer-shared-1 consumer-shared-2
assert_eq "sharedReceived" "$(( $(count_log consumer-shared-1 'status=received') + $(count_log consumer-shared-2 'status=received') ))" 3
assert_eq "sharedUnique" "$(unique_logs 'messageId=[^ ]*' consumer-shared-1 consumer-shared-2)" 3
assert_eq "sharedS1GotMessages" "$(gt0 "$(count_log consumer-shared-1 'status=received')")" true
assert_eq "sharedS2GotMessages" "$(gt0 "$(count_log consumer-shared-2 'status=received')")" true

# --- 阶段 3：Failover。同 priority 按 consumer name 稳定排序，a-primary 收全量、b-replica 备用。
compose up -d --no-deps consumer-failover-primary
wait_subscribed consumer-failover-primary
compose up -d --no-deps consumer-failover-replica
wait_subscribed consumer-failover-replica
compose up -d --no-deps producer-failover
compose wait producer-failover || true
compose wait consumer-failover-primary || true
compose wait consumer-failover-replica || true
collect_logs consumer-failover-primary consumer-failover-replica
assert_eq "failoverPrimaryReceived" "$(count_log consumer-failover-primary 'status=received')" 3
assert_eq "failoverReplicaReceived" "$(count_log consumer-failover-replica 'status=received')" 0

compose up -d --no-deps consumer-failover-promoted
wait_subscribed consumer-failover-promoted
compose up -d --no-deps producer-failover-promoted
compose wait producer-failover-promoted || true
compose wait consumer-failover-promoted || true
collect_logs consumer-failover-promoted
assert_eq "failoverPromotedReceived" "$(count_log consumer-failover-promoted 'status=received')" 3

# --- 阶段 4：Key_Shared。两个 key 各 3 条，同 key 粘连同一消费者。
compose up -d --no-deps consumer-keyshared-1 consumer-keyshared-2
wait_subscribed consumer-keyshared-1
wait_subscribed consumer-keyshared-2
compose up -d --no-deps producer-keyshared
compose wait producer-keyshared || true
compose wait consumer-keyshared-1 consumer-keyshared-2 || true
collect_logs consumer-keyshared-1 consumer-keyshared-2
assert_eq "keySharedReceived" "$(( $(count_log consumer-keyshared-1 'status=received') + $(count_log consumer-keyshared-2 'status=received') ))" 6
# 同 key 粘连：每个 aggregateId 的 received 事件只能出自同一个 consumer。
sticky=true
for agg in order-1001 order-1002; do
  distinct="$({ grep "aggregateId=$agg .* status=received$" "$LAB_DIR/consumer-keyshared-1.out.txt" "$LAB_DIR/consumer-keyshared-2.out.txt" || true; } \
    | { grep -o 'consumer=[^ ]*' || true; } | sort -u | wc -l | tr -d ' ')"
  [ "$distinct" = 1 ] || sticky=false
done
assert_eq "keySharedSameKeySticky" "$sticky" true
finish
