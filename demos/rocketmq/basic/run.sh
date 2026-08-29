#!/usr/bin/env bash
# rocketmq/basic：Normal Topic + SimpleConsumer 手动确认 + 幂等落库，发 3 收 3，消费位点追平。
# broker.conf 关闭自动创建：Topic/消费组须经 mqadmin 显式创建并等路由可见，故分两阶段编排——
# 阶段 1 只起 namesrv/broker/proxy 并建拓扑；阶段 2 起 setup/producer/consumer/inspect-db。
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

# consume_diff <group>：汇总消费 diff，核对消费位点是否追平。
consume_diff() {
  { compose exec -T broker sh mqadmin consumerProgress -g "$1" -n namesrv:9876 2>&1 || true; } |
    awk '/Consume Diff Total:/ { print $NF; found = 1; exit } END { if (!found) print -999 }'
}

ensure_jar rocketmq
compose up -d proxy
wait_healthy proxy
create_topic orders-basic NORMAL
create_group orders-basic-group

compose up -d
compose wait inspect-db || true
collect_logs setup producer consumer inspect-db

assert_eq "produced" "$(count_log producer 'status=produced')" 3
assert_eq "received" "$(count_log consumer 'status=received')" 3
assert_eq "uniqueMessageIds" "$(unique_log consumer 'messageId=[^ ]*')" 3
assert_eq "businessCommitted" "$(count_log consumer 'status=business_committed')" 3
assert_eq "business_rows" "$(field_log inspect-db business_rows)" 3
assert_eq "consumeDiff" "$(consume_diff orders-basic-group)" 0
assert_exit consumer 0
finish
