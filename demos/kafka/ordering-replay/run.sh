#!/usr/bin/env bash
# kafka/ordering-replay：同 key 6 条进同一分区且保序（seq 1..6），新消费组 g2 从 offset 0 全量回放。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar kafka
compose_up consumer-g2
collect_logs setup producer consumer-g1 consumer-g2

assert_eq "produced" "$(count_log producer 'status=produced')" 6
assert_eq "samePartitionOnProduce" "$(unique_log producer 'partitionOrQueue=[^ ]*')" 1
assert_eq "samePartitionOnConsume" "$(unique_log consumer-g1 'partitionOrQueue=[^ ]*')" 1
observed_seq="$({ grep -- 'status=received' "$LAB_DIR/consumer-g1.out.txt" || true; } \
  | { grep -o -- 'seq=[^ ]*' || true; } | cut -d= -f2 | paste -sd, -)"
assert_eq "observedOrder" "$observed_seq" "1,2,3,4,5,6"
assert_eq "replayed" "$(count_log consumer-g2 'status=received')" 6
replay_min_offset="$({ grep -- 'status=received' "$LAB_DIR/consumer-g2.out.txt" || true; } \
  | { grep -o -- 'offset=[^ ]*' || true; } | cut -d= -f2 | sort -n | head -n 1)"
assert_eq "replayFromOffset0" "$replay_min_offset" 0
assert_eq "replayUniqueMessageIds" "$(unique_log consumer-g2 'messageId=[^ ]*')" 6
finish
