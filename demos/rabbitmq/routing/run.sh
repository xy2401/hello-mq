#!/usr/bin/env bash
# rabbitmq/routing：Topic Exchange 三种绑定模式（order.created / # / order.created.eu）的路由分发对比。
set -euo pipefail
LAB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$LAB_DIR/../../shared/run-common.sh"

ensure_jar rabbitmq
compose_up consumer-created consumer-all consumer-eu
collect_logs setup producer consumer-created consumer-all consumer-eu

assert_eq "confirmed" "$(count_log producer 'status=confirmed')" 3
assert_eq "received:orders.routing.created" "$(count_log consumer-created 'status=received')" 2
assert_eq "unique:orders.routing.created" "$(unique_log consumer-created 'messageId=[^ ]*')" 2
assert_eq "depthAfter:orders.routing.created" "$(rabbitmq_queue_depth orders.routing.created)" 0
assert_eq "received:orders.routing.all" "$(count_log consumer-all 'status=received')" 3
assert_eq "unique:orders.routing.all" "$(unique_log consumer-all 'messageId=[^ ]*')" 3
assert_eq "depthAfter:orders.routing.all" "$(rabbitmq_queue_depth orders.routing.all)" 0
assert_eq "received:orders.routing.eu" "$(count_log consumer-eu 'status=received')" 1
assert_eq "unique:orders.routing.eu" "$(unique_log consumer-eu 'messageId=[^ ]*')" 1
assert_eq "depthAfter:orders.routing.eu" "$(rabbitmq_queue_depth orders.routing.eu)" 0
finish
