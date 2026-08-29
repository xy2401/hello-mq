#!/usr/bin/env bash
# hello-mq 实验公共函数：各实验 run.sh 先设置 LAB_DIR 再 source 本文件。
# 职责：jar 构建检查、compose 启动与等待、按角色收集日志、断言、退出时清理。
set -euo pipefail

: "${LAB_DIR:?run-common.sh 需在 source 前设置 LAB_DIR 为实验目录}"

PRODUCT="$(basename "$(dirname "$LAB_DIR")")"
LAB="$(basename "$LAB_DIR")"
PROJECT="hello-mq-${PRODUCT}-${LAB}"
ENV_FILE="$LAB_DIR/../../../.env.versions"
ASSERT_FILE="$LAB_DIR/assert.out.txt"
FAILURES=0
REPLAY_GATE_SEQUENCE=0
: > "$ASSERT_FILE"

# replay_checkpoint <名称>：仅在证据采集模式下暂停宿主编排脚本。
# collector 读取真实 Broker 状态后创建同名 .release 文件；30 秒无响应即失败，避免实验永久挂起。
replay_checkpoint() {
  local checkpoint="$1" token reached release deadline
  case "${HELLO_MQ_REPLAY_CAPTURE:-0}" in
    1|true|yes) ;;
    *) return 0 ;;
  esac
  REPLAY_GATE_SEQUENCE=$((REPLAY_GATE_SEQUENCE + 1))
  token="shell-${REPLAY_GATE_SEQUENCE}-$(printf '%s' "$checkpoint" | tr -c 'A-Za-z0-9_.-' '_')"
  mkdir -p "$LAB_DIR/.replay-gate"
  reached="$LAB_DIR/.replay-gate/${token}.reached"
  release="$LAB_DIR/.replay-gate/${token}.release"
  printf 'timestamp=%s checkpoint=%s messageId=none\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$checkpoint" > "$reached"
  deadline=$(( $(date +%s) + 30 ))
  while [ ! -f "$release" ]; do
    if [ "$(date +%s)" -ge "$deadline" ]; then
      printf 'Replay checkpoint timed out: %s\n' "$checkpoint" >&2
      return 1
    fi
    sleep 0.1
  done
  rm -f "$release"
}

compose() {
  docker compose -p "$PROJECT" -f "$LAB_DIR/docker-compose.yml" --env-file "$ENV_FILE" "$@"
}

cleanup() {
  compose down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

# ensure_jar <product>：jar 缺失时才触发 Maven 构建（只建该模块及其依赖）。
ensure_jar() {
  local product="$1"
  local jar="$LAB_DIR/../target/hello-mq-${product}.jar"
  if [ ! -f "$jar" ]; then
    mvn -B -f "$LAB_DIR/../../pom.xml" package -DskipTests -pl "$product" -am
  fi
}

# compose_up <终止服务...>：后台启动完整流程，等待终止服务退出（编排顺序由 compose depends_on 保证）。
compose_up() {
  compose up -d
  replay_checkpoint services-started
  compose wait "$@" || true
}

# collect_logs <服务...>：每个服务日志落到实验目录 <服务>.out.txt。
collect_logs() {
  local service
  for service in "$@"; do
    compose logs --no-color --no-log-prefix "$service" > "$LAB_DIR/${service}.out.txt"
  done
}

# count_log <服务> <模式>：日志中匹配行数（无匹配为 0）。
count_log() {
  { grep -c -- "$2" "$LAB_DIR/$1.out.txt" || true; }
}

# unique_log <服务> <模式>：匹配内容去重后的个数。
unique_log() {
  { grep -o -- "$2" "$LAB_DIR/$1.out.txt" || true; } | sort -u | wc -l | tr -d ' '
}

# unique_logs <模式> <服务...>：跨多个服务日志的匹配内容去重个数。
unique_logs() {
  local pattern="$1" service
  shift
  {
    for service in "$@"; do
      grep -o -- "$pattern" "$LAB_DIR/${service}.out.txt" || true
    done
  } | sort -u | wc -l | tr -d ' '
}

# field_log <服务> <键>：取日志中最后一次 key=value 的值。
field_log() {
  { grep -o -- "$2=[^ ]*" "$LAB_DIR/$1.out.txt" || true; } | tail -n 1 | cut -d= -f2
}

service_exit_code() {
  local cid
  # --all：compose v2 的 ps 默认只列运行中容器，一次性服务已退出必须带 --all 才能取到 ID
  cid="$(compose ps -q --all "$1" | tail -n 1)"
  docker inspect -f '{{.State.ExitCode}}' "$cid"
}

assert_eq() {
  local name="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    printf 'PASS %s: %s\n' "$name" "$actual" >> "$ASSERT_FILE"
  else
    printf 'FAIL %s: expected=%s actual=%s\n' "$name" "$expected" "$actual" >> "$ASSERT_FILE"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_exit() {
  assert_eq "$1.exitCode" "$(service_exit_code "$1")" "$2"
}

finish() {
  replay_checkpoint final-state
  if [ "$FAILURES" -gt 0 ]; then
    printf 'RESULT: %d assertion(s) FAILED\n' "$FAILURES" >> "$ASSERT_FILE"
    cat "$ASSERT_FILE" >&2
    exit 1
  fi
  printf 'RESULT: all assertions passed\n' >> "$ASSERT_FILE"
  cat "$ASSERT_FILE"
}

# rabbitmq_queue_depth <队列>：经 rabbitmqctl 查队列深度（队列不存在按 0）。
rabbitmq_queue_depth() {
  compose exec -T rabbitmq rabbitmqctl list_queues name messages --formatter=json \
    | jq --arg q "$1" '[ .[] | select(.name == $q) | .messages ] | first // 0'
}

# kafka_group_lag <消费组>：汇总该组所有分区 lag。
kafka_group_lag() {
  compose exec -T kafka /opt/kafka/bin/kafka-consumer-groups.sh \
    --bootstrap-server localhost:9092 --describe --group "$1" \
    | awk 'NR > 1 && NF >= 6 && $6 != "-" { lag += $6 } END { print lag + 0 }'
}
