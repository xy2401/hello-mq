#!/usr/bin/env bash
# hello-mq rabbitmq/cli-tools：队列/状态操作只用镜像自带 rabbitmqctl / rabbitmq-diagnostics /
# rabbitmqadmin；镜像内无 curl，收发消息走宿主机 curl 调 management HTTP API（15672）。
# 六段：bin 列表 → 节点状态 → 建队列 → publish ×3 → get 消费 → 队列深度复查。
# 独立运行：bash run.sh
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

QUEUE=orders-cli
SBIN=/opt/rabbitmq/sbin
API=http://127.0.0.1:15672

# step <outfile> <cmd...>：容器内执行，stdout/stderr 合并落 <outfile>，失败即终止。
step() {
  local out="$1"
  shift
  echo "[cli-tools] \$ $*" > "$LAB_DIR/$out"
  if ! compose exec -T rabbitmq "$@" >> "$LAB_DIR/$out" 2>&1; then
    tail -n 30 "$LAB_DIR/$out" >&2
    exit 1
  fi
}

# host_api <outfile> <method> <path> <data>：宿主机 curl 调 management API（不走 step()），
# 命令与响应追加落 <outfile>，HTTP 非 200 即终止。
host_api() {
  local out="$1" method="$2" path="$3" data="${4-}"
  local args=(-s -w $'\n%{http_code}' -u guest:guest -X "$method"
    -H 'content-type: application/json' "$API$path")
  local resp code body
  [ -n "$data" ] && args+=(-d "$data")
  echo "[cli-tools] \$ curl -s -u guest:guest -X $method $API$path -d '$data'" >> "$LAB_DIR/$out"
  if ! resp="$(curl "${args[@]}")"; then
    echo "curl $method $API$path failed" >&2
    exit 1
  fi
  code="${resp##*$'\n'}"
  body="${resp%$'\n'*}"
  printf '%s\n' "$body" >> "$LAB_DIR/$out"
  if [ "$code" != "200" ]; then
    tail -n 30 "$LAB_DIR/$out" >&2
    exit 1
  fi
}

# check_running 通过不代表 management 监听就绪：publish 前先等 /api/overview 可用。
wait_management() {
  local i
  for i in $(seq 1 30); do
    if curl -s -u guest:guest "$API/api/overview" | grep -q rabbitmq_version; then
      return 0
    fi
    sleep 2
  done
  printf 'management API not ready within 60s\n' >&2
  exit 1
}

compose up -d --wait --wait-timeout 120
wait_management

step bin-list.out.txt ls "$SBIN"
step status.out.txt sh -c 'rabbitmqctl status && echo && rabbitmq-diagnostics check_running'
# 4.x 实测：rabbitmqctl 已无 add_queue（报 Command 'add_queue' not found），
# 队列声明改用 management 镜像自带的 rabbitmqadmin。
step create.out.txt rabbitmqadmin declare queue name="$QUEUE" durable=true
: > "$LAB_DIR/produce.out.txt"
for i in 1 2 3; do
  host_api produce.out.txt POST /api/exchanges/%2F/amq.default/publish \
    "{\"properties\":{},\"routing_key\":\"$QUEUE\",\"payload\":\"order-cli-$i\",\"payload_encoding\":\"string\"}"
done
# get 请求体字段为 ackmode（不是 ack_mode，后者实测 400 key_missing,ackmode）；
# ack_requeue_false 即 ack 后不重回队列，消费即删除。
: > "$LAB_DIR/consume.out.txt"
host_api consume.out.txt POST "/api/queues/%2F/$QUEUE/get" \
  '{"count":3,"ackmode":"ack_requeue_false","encoding":"auto"}'
step verify.out.txt rabbitmqctl list_queues name messages

assert_eq "binCount" "$(grep -c '^[a-z]' "$LAB_DIR/bin-list.out.txt")" 10
assert_eq "nodeRunning" "$(grep -c 'fully booted and running' "$LAB_DIR/status.out.txt")" 1
assert_eq "queueCreated" "$(grep -c 'queue declared' "$LAB_DIR/create.out.txt")" 1
assert_eq "routedCount" "$(grep -c '"routed":true' "$LAB_DIR/produce.out.txt")" 3
assert_eq "consumedCount" "$(tail -n +2 "$LAB_DIR/consume.out.txt" | jq 'length')" 3
assert_eq "consumedUnique" "$(tail -n +2 "$LAB_DIR/consume.out.txt" | jq '[.[].payload] | unique | length')" 3
assert_eq "queueDepth" "$(rabbitmq_queue_depth "$QUEUE")" 0

finish
