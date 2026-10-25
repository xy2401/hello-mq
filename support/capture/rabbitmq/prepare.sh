#!/usr/bin/env bash
# Sourced once by the case runner; all cases share this isolated temporary node.
set -Eeuo pipefail
export HOME=/capture/work
export PATH="/opt/rabbitmq/sbin:/opt/erlang/bin:$PATH"
export RABBITMQ_NODENAME="rabbit@$(hostname -s)"
export RABBITMQ_MNESIA_BASE=/capture/work/rabbitmq/mnesia
export RABBITMQ_LOG_BASE=/capture/work/rabbitmq/log
export RABBITMQ_PID_FILE=/capture/work/rabbitmq.pid
export RABBITMQ_ENABLED_PLUGINS_FILE=/capture/work/rabbitmq/enabled_plugins
export RABBITMQ_SERVER_ADDITIONAL_ERL_ARGS='+S 2:2'
export RABBITMQ_CTL_ERL_ARGS='+S 1:1'
mkdir -p "$RABBITMQ_MNESIA_BASE" "$RABBITMQ_LOG_BASE"
rabbitmq-server > /capture/work/rabbitmq-server.stdout 2> /capture/work/rabbitmq-server.stderr &
rabbit_pid=$!
cleanup_rabbitmq() {
  local status=$?
  trap - EXIT INT TERM
  timeout 30 rabbitmqctl stop > /capture/work/rabbitmq-stop.stdout 2> /capture/work/rabbitmq-stop.stderr || true
  kill -TERM "$rabbit_pid" 2>/dev/null || true
  wait "$rabbit_pid" 2>/dev/null || true
  exit "$status"
}
trap cleanup_rabbitmq EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
ready=0
for ((i=0; i<60; i++)); do
  if timeout 10 rabbitmq-diagnostics -q check_running \
    > /capture/work/rabbitmq-ready.stdout 2> /capture/work/rabbitmq-ready.stderr; then
    ready=1
    break
  fi
  kill -0 "$rabbit_pid"
  sleep 2
done
if [[ "$ready" != 1 ]]; then
  cat /capture/work/rabbitmq-server.stderr >&2
  printf '%s\n' 'RabbitMQ did not become ready within 60 attempts' >&2
  exit 1
fi

