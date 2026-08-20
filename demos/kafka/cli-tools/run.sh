#!/usr/bin/env bash
# hello-mq kafka/cli-tools：全程只用镜像自带 /opt/kafka/bin/*.sh，不引入任何客户端 SDK。
# 五段：bin 列表 → 集群状态 → 建 topic → console-producer 生产 → console-consumer 消费 → 消费组复查。
# 独立运行：bash run.sh
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

TOPIC=orders.cli
GROUP=orders-cli-group
BIN=/opt/kafka/bin

# step <outfile> <cmd...>：容器内执行，stdout/stderr 合并落 <outfile>。
step() {
  local out="$1"
  shift
  echo "[cli-tools] \$ $*" > "$LAB_DIR/$out"
  compose exec -T kafka "$@" >> "$LAB_DIR/$out" 2>&1
}

compose up -d --wait --wait-timeout 120

step bin-list.out.txt sh -c 'ls /opt/kafka/bin | grep "\.sh$"'
step status.out.txt "$BIN/kafka-cluster.sh" cluster-id --bootstrap-server localhost:9092
step create.out.txt "$BIN/kafka-topics.sh" --create --topic "$TOPIC" \
  --partitions 1 --replication-factor 1 --bootstrap-server localhost:9092
step produce.out.txt sh -c \
  "printf 'order-cli-1\norder-cli-2\norder-cli-3\n' | $BIN/kafka-console-producer.sh --bootstrap-server localhost:9092 --topic $TOPIC"
step consume.out.txt "$BIN/kafka-console-consumer.sh" --bootstrap-server localhost:9092 \
  --topic "$TOPIC" --group "$GROUP" --from-beginning --max-messages 3 --timeout-ms 30000
step verify.out.txt "$BIN/kafka-consumer-groups.sh" --bootstrap-server localhost:9092 --describe --group "$GROUP"

assert_eq "binCount" "$(grep -c '\.sh$' "$LAB_DIR/bin-list.out.txt")" 43
assert_eq "consumedCount" "$(count_log consume '^order-cli-')" 3
assert_eq "endOffset" "$(awk -v g="$GROUP" -v t="$TOPIC" '$1==g && $2==t {print $5; exit}' "$LAB_DIR/verify.out.txt")" 3
assert_eq "consumerGroupLag" "$(kafka_group_lag "$GROUP")" 0

finish
