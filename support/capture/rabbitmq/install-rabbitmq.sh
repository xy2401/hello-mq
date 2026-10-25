#!/usr/bin/env bash
set -Eeuo pipefail
recipe=${1:?Pass the RabbitMQ recipe JSON}
evidence=/usr/local/share/hello-capture/rabbitmq
mkdir -p "$evidence"
cp "$recipe" "$evidence/recipe.json"
asset=$(jq -ce '.artifacts[] | select(.id == "rabbitmq")' "$recipe")
downloads=$(mktemp -d)
trap 'rm -rf -- "$downloads"' EXIT
archive="$downloads/rabbitmq.tar.xz"
curl --fail --location --retry 3 --output "$archive" "$(jq -r '.url' <<< "$asset")"
printf '%s  %s\n' "$(jq -r '.sha256' <<< "$asset")" "$archive" | sha256sum --check --strict
tar -tJf "$archive" > "$evidence/archive-files.txt"
mkdir -p /opt/rabbitmq
tar -xJf "$archive" -C /opt/rabbitmq --strip-components=1

