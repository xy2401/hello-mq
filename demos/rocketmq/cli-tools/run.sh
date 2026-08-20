#!/usr/bin/env bash
# hello-mq rocketmq/cli-tools：全程只用镜像自带 mqadmin，不引入任何客户端 SDK。
# 六段：bin 列表 → 集群状态 → 建 topic → sendMessage 生产 → consumeMessage 消费 → topicStatus 复查。
# 独立运行：bash run.sh
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

TOPIC=ordersCli
BIN=/home/rocketmq/rocketmq-5.5.0/bin

# step <outfile> <cmd...>：容器内执行，stdout/stderr 合并落 <outfile>。
step() {
  local out="$1"
  shift
  echo "[cli-tools] \$ $*" > "$LAB_DIR/$out"
  compose exec -T broker "$@" >> "$LAB_DIR/$out" 2>&1
}

# mqadmin_append <outfile> <子命令与参数...>：输出追加落 <outfile>（供 produce 循环复用），失败即终止。
# 5.x 参数顺序陷阱：子命令必须在最前，-n 等选项放子命令之后，否则可能静默失败（exit 0）；
# 因此除退出码外再扫描输出中的异常关键字兜底（经验见 fifo-delay/run.sh 的 mqadmin 封装）。
mqadmin_append() {
  local out="$1"
  shift
  echo "[cli-tools] \$ mqadmin $*" >> "$LAB_DIR/$out"
  if ! compose exec -T broker sh mqadmin "$@" >> "$LAB_DIR/$out" 2>&1; then
    tail -n 30 "$LAB_DIR/$out" >&2
    exit 1
  fi
  if grep -qiE 'exception|error|fail' "$LAB_DIR/$out"; then
    tail -n 30 "$LAB_DIR/$out" >&2
    exit 1
  fi
}

# mqadmin <outfile> <子命令与参数...>：先清空 <outfile> 再执行（每步独立快照，重跑不残留）。
mqadmin() {
  local out="$1"
  shift
  : > "$LAB_DIR/$out"
  mqadmin_append "$out" "$@"
}

# Broker 先监听 10911 再向 NameServer 注册：healthcheck（TCP）通过时集群信息可能尚未就绪，
# updateTopic -c 会报 "[error] Make sure the specified clusterName exists"，先等注册完成。
wait_cluster() {
  local i out
  for i in $(seq 1 30); do
    if out="$(compose exec -T broker sh mqadmin clusterList -n namesrv:9876 2>&1)" &&
      printf '%s\n' "$out" | grep -q hello-mq-broker; then
      return 0
    fi
    sleep 2
  done
  printf 'broker not registered in namesrv within 60s\n' >&2
  exit 1
}

# Broker 每 ~30s 向 NameServer 心跳注册路由：创建后等路由可见再收发消息，避免 No route info。
wait_route() {
  local i out
  for i in $(seq 1 30); do
    if out="$(compose exec -T broker sh mqadmin topicRoute -t "$TOPIC" -n namesrv:9876 2>&1)" &&
      printf '%s\n' "$out" | grep -q brokerName; then
      return 0
    fi
    sleep 2
  done
  printf 'topic route for %s not visible in namesrv within 60s\n' "$TOPIC" >&2
  exit 1
}

compose up -d --wait --wait-timeout 120
wait_cluster

step bin-list.out.txt sh -c "ls $BIN"
mqadmin status.out.txt clusterList -n namesrv:9876
mqadmin create.out.txt updateTopic -n namesrv:9876 -c DefaultCluster -t "$TOPIC"
wait_route
: > "$LAB_DIR/produce.out.txt"
for i in 1 2 3; do
  mqadmin_append produce.out.txt sendMessage -n namesrv:9876 -t "$TOPIC" -p "order-cli-$i" -c TagCli
done
# consumeMessage 实测：-c <N> 并非可靠的条数上限（源码对每个访问过的队列都会扣减 countLeft，
# -c 3 在 8 队列下可能只消费到 1 条）；默认 messageCount=128 足以排空本实验的 3 条消息。
mqadmin consume.out.txt consumeMessage -n namesrv:9876 -t "$TOPIC"
mqadmin verify.out.txt topicStatus -n namesrv:9876 -t "$TOPIC"

assert_eq "binCount" "$(grep -c '^[a-zA-Z]' "$LAB_DIR/bin-list.out.txt")" 36
assert_eq "brokerInCluster" "$(grep -c 'hello-mq-broker' "$LAB_DIR/status.out.txt")" 1
assert_eq "topicCreated" "$(grep -c 'create topic.*success' "$LAB_DIR/create.out.txt")" 1
assert_eq "sentCount" "$(grep -c 'SEND_OK' "$LAB_DIR/produce.out.txt")" 3
assert_eq "consumedCount" "$(grep -c 'BODY: order-cli-' "$LAB_DIR/consume.out.txt")" 3
assert_eq "consumedUnique" "$({ grep -o 'BODY: order-cli-[0-9]' "$LAB_DIR/consume.out.txt" || true; } | sort -u | wc -l | tr -d ' ')" 3
assert_eq "maxOffsetSum" "$(awk '/^hello-mq-broker/ {sum += $4} END {print sum + 0}' "$LAB_DIR/verify.out.txt")" 3

finish
