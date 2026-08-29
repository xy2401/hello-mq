#!/usr/bin/env bash
# nats/core-pubsub：Core NATS 易失语义——无订阅者时发布 3 条全部丢失；先订阅再发布则 3 发 3 收。
# 分两阶段：阶段 1 无订阅者发布 lost；阶段 2 起 consumer，等订阅注册（status=subscribed）后再发布 live。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar nats
compose up -d --no-deps nats
wait_http_ready http://127.0.0.1:8222/healthz nats 90
compose up -d producer-lost
compose wait producer-lost || true
# producer-lost 是已完成的一次性依赖；禁止 Compose 在启动 consumer 时重新创建并再发布一遍。
compose up -d --no-deps consumer
# Core NATS 无缓冲、无确认：必须等订阅抵达服务端再发布，否则 live 消息同样会丢。
for _ in $(seq 1 60); do
  if compose logs --no-color --no-log-prefix consumer | grep -q 'status=subscribed'; then
    break
  fi
  sleep 1
done
compose up -d --no-deps producer-live
compose wait producer-live || true
compose wait consumer || true
compose up -d --no-deps inspect-db
compose wait inspect-db || true
collect_logs setup producer-lost consumer producer-live inspect-db

assert_eq "lostPublished" "$(count_log producer-lost 'status=published')" 3
assert_eq "livePublished" "$(count_log producer-live 'status=published')" 3
assert_eq "received" "$(count_log consumer 'status=received')" 3
assert_eq "uniqueMessageIds" "$(unique_log consumer 'messageId=[^ ]*')" 3
assert_eq "businessCommitted" "$(count_log consumer 'status=business_committed')" 3
assert_eq "business_rows" "$(field_log inspect-db business_rows)" 3
assert_exit consumer 0
finish
