#!/usr/bin/env bash
# rocketmq/retry-dlq：毒消息按消费组重试策略（最多 2 次、间隔 1s）重投，耗尽后进 %DLQ% 组 Topic；
# 正常消息恰好消费 1 次落库。重试策略与 %DLQ% Topic 均由 mqadmin 随消费组显式创建。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

# mqadmin 5.x 要求子命令在最前，-n 等选项必须放在子命令之后，否则会静默失败（exit 0）。
mqadmin() {
  local out
  if ! out="$(compose exec -T broker sh mqadmin "$@" -n namesrv:9876 2>&1)"; then
    printf 'mqadmin %s failed:\n%s\n' "$*" "$out" >&2
    exit 1
  fi
  if printf '%s\n' "$out" | grep -qiE 'not exist|exception|error'; then
    printf 'mqadmin %s reported error:\n%s\n' "$*" "$out" >&2
    exit 1
  fi
}

# Broker 每 ~30s 向 NameServer 心跳注册路由：创建后必须等路由可见，否则客户端报 40402。
wait_route() {
  local topic="$1" i out
  for i in $(seq 1 30); do
    if out="$(compose exec -T broker sh mqadmin topicRoute -t "$topic" -n namesrv:9876 2>&1)" &&
      printf '%s\n' "$out" | grep -q brokerName; then
      return 0
    fi
    sleep 2
  done
  printf 'topic route for %s not visible in namesrv within 60s\n' "$topic" >&2
  exit 1
}

create_topic() { # <topic> <message.type>
  mqadmin updateTopic -c DefaultCluster -t "$1" -r 4 -w 4 -a "+message.type=$2"
  wait_route "$1"
}

create_group() { # <group> [updateSubGroup 额外参数...]
  local group="$1"
  shift
  mqadmin updateSubGroup -c DefaultCluster -g "$group" "$@"
  # broker.conf 关闭自动创建：%RETRY% 路由须显式创建并等可见，否则重试/consumerProgress 报 40402。
  mqadmin updateTopic -c DefaultCluster -t "%RETRY%${group}" -r 1 -w 1
  wait_route "%RETRY%${group}"
}

ensure_jar rocketmq
compose up -d broker
wait_healthy broker
wait_rocketmq_registered
compose up -d --no-deps proxy
wait_healthy proxy
create_topic orders-retry NORMAL
# 重试策略由消费组承载：最多重试 2 次、每次间隔 1s（CUSTOMIZED），耗尽后进 %DLQ%。
retry_policy='{"type":"CUSTOMIZED","customizedRetryPolicy":{"next":[1000,1000]}}'
create_group orders-retry-group -r 2 -p "$retry_policy"
mqadmin updateTopic -c DefaultCluster -t '%DLQ%orders-retry-group' -r 1 -w 1
wait_route '%DLQ%orders-retry-group'
create_group orders-dlq-inspect

compose up -d
compose wait consumer-dlq || true
collect_logs setup producer consumer inspect-db consumer-dlq

assert_eq "produced" "$(count_log producer 'status=produced')" 2
assert_eq "okReceived" "$(count_log consumer 'status=received')" 1
assert_eq "businessCommitted" "$(count_log consumer 'status=business_committed')" 1
assert_eq "business_rows" "$(field_log inspect-db business_rows)" 1
poison_failed="$(count_log consumer 'status=consume_failed')"
if [ "$poison_failed" -ge 2 ]; then poison_attempts_ok=true; else poison_attempts_ok=false; fi
assert_eq "poisonAttempts" "$poison_attempts_ok" "true"
assert_eq "poisonMaxAttempt" "$(field_log consumer poisonMaxAttempt)" 3
assert_eq "dlqReceived" "$(count_log consumer-dlq 'status=received')" 1
assert_eq "dlqIsPoison" "$({ grep 'status=received' "$LAB_DIR/consumer-dlq.out.txt" || true; } | { grep -c 'aggregateId=order-poison' || true; })" 1
finish
