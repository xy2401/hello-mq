#!/usr/bin/env bash
# rocketmq/transaction：Half Message 首查回 UNKNOWN，第二次回查 COMMIT；消息最终恰好消费 1 次。
# 回查间隔 2s（../broker.conf transactionCheckInterval），40s 窗口内 checkBacks 必 ≥2。
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
compose up -d proxy
wait_healthy proxy
create_topic orders-txn TRANSACTION
create_group orders-txn-group

compose up -d
compose wait inspect-db || true
collect_logs setup producer consumer inspect-db

assert_eq "halfSent" "$(count_log producer 'status=half_sent')" 1
check_backs="$(field_log producer checkBacks)"
if [ -n "$check_backs" ] && [ "$check_backs" -ge 2 ]; then check_backs_ok=true; else check_backs_ok=false; fi
assert_eq "checkBacksAtLeast2" "$check_backs_ok" "true"
assert_eq "received" "$(count_log consumer 'status=received')" 1
assert_eq "businessCommitted" "$(count_log consumer 'status=business_committed')" 1
assert_eq "business_rows" "$(field_log inspect-db business_rows)" 1
finish
