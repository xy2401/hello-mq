#!/usr/bin/env bash
# hello-mq activemq-classic/cli-tools：全程只用镜像自带 /opt/apache-activemq/bin/activemq，不引入任何客户端 SDK。
# Classic 没有显式建队命令：向全新队列首次生产/订阅即自动创建。
# 六段：bin 列表 → broker 状态 → 首条消息自动建队 → 再生产 2 条 → 消费 3 条 → 空队列复查。
# 默认匿名访问 tcp://localhost:61616，命令全部在容器内执行。
# 独立运行：bash run.sh
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

QUEUE=orders-cli
ACTIVEMQ_BIN=/opt/apache-activemq/bin/activemq

# step <outfile> <cmd...>：容器内执行，stdout/stderr 合并落 <outfile>。
step() {
  local out="$1"
  shift
  echo "[cli-tools] \$ $*" > "$LAB_DIR/$out"
  compose exec -T activemq "$@" >> "$LAB_DIR/$out" 2>&1
}

compose up -d --wait --wait-timeout 120

step bin-list.out.txt sh -c "ls /opt/apache-activemq/bin && $ACTIVEMQ_BIN version"
step status.out.txt "$ACTIVEMQ_BIN" status
# Classic 无显式建队命令：向全新队列 orders-cli 生产第 1 条消息时队列自动创建。
step create.out.txt "$ACTIVEMQ_BIN" producer --destination "queue://$QUEUE" \
  --messageCount 1 --message order-cli-1
# --message 只能固定内容：循环 2 次各发 1 条，payload 才能是 order-cli-2/3。
echo "[cli-tools] \$ for i in 2 3: $ACTIVEMQ_BIN producer --destination queue://$QUEUE --messageCount 1 --message order-cli-\$i ..." > "$LAB_DIR/produce.out.txt"
for i in 2 3; do
  compose exec -T activemq "$ACTIVEMQ_BIN" producer --destination "queue://$QUEUE" \
    --messageCount 1 --message "order-cli-$i" >> "$LAB_DIR/produce.out.txt" 2>&1
done
# 收满 --messageCount 条即自动退出。
step consume.out.txt "$ACTIVEMQ_BIN" consumer --destination "queue://$QUEUE" --messageCount 3
# 空队列时 consumer 无限阻塞（Classic consumer 无 receive-timeout 参数），用 timeout 15 包裹：
# 若 15s 内收不到任何消息被 timeout 杀掉（exit 124），即为队列已排空的证据。
echo "[cli-tools] \$ timeout 15 $ACTIVEMQ_BIN consumer --destination queue://$QUEUE --messageCount 1（空队列将阻塞至被 timeout 杀掉，预期 exit 124）" > "$LAB_DIR/verify.out.txt"
set +e
compose exec -T activemq timeout 15 "$ACTIVEMQ_BIN" consumer --destination "queue://$QUEUE" --messageCount 1 \
  >> "$LAB_DIR/verify.out.txt" 2>&1
VERIFY_EXIT=$?
set -e
echo "[cli-tools] verify exitCode=$VERIFY_EXIT（124=被 timeout 杀掉，说明队列已空）" >> "$LAB_DIR/verify.out.txt"

# bin 清单 7 项均为小写开头；version 输出以 INFO 大写行开始，用 ^[a-z] 精确计数。
assert_eq "binCount" "$(grep -c '^[a-z]' "$LAB_DIR/bin-list.out.txt")" 7
assert_eq "statusRunning" "$(count_log status 'ActiveMQ is running')" 1
assert_eq "producedCount" "$(cat "$LAB_DIR/create.out.txt" "$LAB_DIR/produce.out.txt" | grep -c 'Produced: 1 messages')" 3
assert_eq "consumedCount" "$(count_log consume 'Received order-cli-')" 3
assert_eq "consumedSummary" "$(count_log consume 'Consumed: 3 messages')" 1
assert_eq "verifyExit" "$VERIFY_EXIT" 124
assert_eq "verifyReceived" "$(count_log verify 'Received')" 0

finish
