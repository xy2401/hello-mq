#!/usr/bin/env bash
# rocketmq/fifo-delay：FIFO Topic 同 MessageGroup 保序（先生产后消费仍按 seq 1,2,3），
# 定时消息请求延迟 3s、实际投递延迟必须 ≥3s。拓扑经 mqadmin 分阶段创建后再起 java 服务。
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
compose wait proxy || true
create_topic orders-fifo FIFO
create_topic orders-delay DELAY
create_group orders-fifo-group
create_group orders-delay-group

compose up -d
compose wait consumer-delay || true
collect_logs setup producer-fifo consumer-fifo producer-delay consumer-delay

assert_eq "fifoProduced" "$(count_log producer-fifo 'status=produced')" 3
assert_eq "observedOrder" "$({ grep 'status=received' "$LAB_DIR/consumer-fifo.out.txt" | grep -o 'seq=[^ ]*' | cut -d= -f2 | paste -sd, - || true; })" "1,2,3"
assert_eq "sameMessageGroup" "$(count_log consumer-fifo 'messageGroup=order-1001')" 3
assert_eq "delayReceived" "$(count_log consumer-delay 'status=received')" 1
delay_ms="$(field_log consumer-delay deliveryDelayMs)"
if [ -n "$delay_ms" ] && [ "$delay_ms" -ge 3000 ]; then delay_ok=true; else delay_ok=false; fi
assert_eq "deliveryDelayMsAtLeast3000" "$delay_ok" "true"
finish
