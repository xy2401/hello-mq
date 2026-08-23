#!/usr/bin/env bash
# hello-mq artemis/cli-tools：全程只用镜像自带 /opt/activemq-artemis/bin/artemis，不引入任何客户端 SDK。
# 2.44 镜像自带 producer/consumer/browser 子命令，可纯 CLI 完成收发闭环。
# 六段：bin 列表 → check node 探活 → 建队列 → producer 生产 3 条 → consumer 消费 3 条 → queue stat/browser 核对清空。
# security-enabled=true，所有命令都要带 --user/--password/--url（容器内 tcp://localhost:61616）。
# 独立运行：bash run.sh
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

QUEUE=orders-cli
ARTEMIS_BIN=/opt/activemq-artemis/bin/artemis
BROKER_URL=tcp://localhost:61616
ARTEMIS_USER=admin
ARTEMIS_PASSWORD=hello-mq-artemis

# step <outfile> <cmd...>：容器内执行，stdout/stderr 合并落 <outfile>。
step() {
  local out="$1"
  shift
  echo "[cli-tools] \$ $*" > "$LAB_DIR/$out"
  compose exec -T artemis "$@" >> "$LAB_DIR/$out" 2>&1
}

compose up -d --wait --wait-timeout 120

step bin-list.out.txt sh -c "ls /opt/activemq-artemis/bin && $ARTEMIS_BIN version"
step status.out.txt "$ARTEMIS_BIN" check node \
  --user "$ARTEMIS_USER" --password "$ARTEMIS_PASSWORD" --url "$BROKER_URL"
# --silent 关闭交互提问；--auto-create-address 允许地址不存在时随队列一并创建。
step create.out.txt "$ARTEMIS_BIN" queue create --name "$QUEUE" --address "$QUEUE" \
  --anycast --durable --auto-create-address --silent \
  --user "$ARTEMIS_USER" --password "$ARTEMIS_PASSWORD" --url "$BROKER_URL"
# --message 只能固定内容：循环 3 次各发 1 条，payload 才能是 order-cli-1/2/3。
echo "[cli-tools] \$ for i in 1 2 3: $ARTEMIS_BIN producer --destination queue://$QUEUE --message-count 1 --message order-cli-\$i ..." > "$LAB_DIR/produce.out.txt"
for i in 1 2 3; do
  compose exec -T artemis "$ARTEMIS_BIN" producer --destination "queue://$QUEUE" \
    --message-count 1 --message "order-cli-$i" \
    --user "$ARTEMIS_USER" --password "$ARTEMIS_PASSWORD" --url "$BROKER_URL" \
    >> "$LAB_DIR/produce.out.txt" 2>&1
done
# --message-count 达到即自动退出；--receive-timeout 兜底，空队列也不会挂死。
step consume.out.txt "$ARTEMIS_BIN" consumer --destination "queue://$QUEUE" \
  --message-count 3 --receive-timeout 10000 --verbose \
  --user "$ARTEMIS_USER" --password "$ARTEMIS_PASSWORD" --url "$BROKER_URL"
step verify.out.txt "$ARTEMIS_BIN" queue stat --queueName "$QUEUE" \
  --user "$ARTEMIS_USER" --password "$ARTEMIS_PASSWORD" --url "$BROKER_URL"
step browser.out.txt "$ARTEMIS_BIN" browser --destination "queue://$QUEUE" \
  --user "$ARTEMIS_USER" --password "$ARTEMIS_PASSWORD" --url "$BROKER_URL"

assert_eq "binHasArtemis" "$(grep -c '^artemis$' "$LAB_DIR/bin-list.out.txt")" 1
assert_eq "version" "$(grep -c 'Apache ActiveMQ Artemis 2\.44\.0' "$LAB_DIR/bin-list.out.txt")" 1
assert_eq "nodeCheck" "$(grep -c 'Failures: 0, Errors: 0' "$LAB_DIR/status.out.txt")" 1
assert_eq "queueCreated" "$(grep -c 'created successfully' "$LAB_DIR/create.out.txt")" 1
assert_eq "producedCount" "$(grep -c 'Produced: 1 messages' "$LAB_DIR/produce.out.txt")" 3
assert_eq "consumedCount" "$(grep -c 'Received order-cli-' "$LAB_DIR/consume.out.txt")" 3
# queue stat 表格按 | 分列：$5=MESSAGE COUNT，$8=MESSAGES ACKED。
assert_eq "messageCount" "$(awk -F'|' '{gsub(/ /,"",$2)} $2=="'"$QUEUE"'" {gsub(/ /,"",$5); print $5; exit}' "$LAB_DIR/verify.out.txt")" 0
assert_eq "messagesAcked" "$(awk -F'|' '{gsub(/ /,"",$2)} $2=="'"$QUEUE"'" {gsub(/ /,"",$8); print $8; exit}' "$LAB_DIR/verify.out.txt")" 3
assert_eq "browsedLeft" "$(grep -o 'browsed: [0-9]*' "$LAB_DIR/browser.out.txt" | awk '{print $2}')" 0

finish
