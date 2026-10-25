#!/usr/bin/env bash
set -Eeuo pipefail
recipe=${1:?Pass the RabbitMQ recipe JSON}
export DEBIAN_FRONTEND=noninteractive
mapfile -t packages < <(jq -r '.dependencies.packages[]' "$recipe")
evidence=/usr/local/share/hello-capture/erlang
mkdir -p "$evidence"
apt-get update
# Preserve actual dependency URLs and hashes before installing or removing debs.
apt-get clean
apt-get --print-uris -o Acquire::ForceHash=SHA256 -y --no-install-recommends \
  install "${packages[@]}" > "$evidence/dependencies.uris.txt"
apt-get -y --download-only --no-install-recommends install "${packages[@]}"
awk '$1 ~ /^\047/ && $4 ~ /^SHA256:/ { sub(/^SHA256:/, "", $4); print $4 "  " $2 }' \
  "$evidence/dependencies.uris.txt" > "$evidence/dependencies.expected.sha256"
(
  cd /var/cache/apt/archives
  find . -maxdepth 1 -type f -name '*.deb' -print0 | sort -z | xargs -0 -r sha256sum \
    > "$evidence/dependencies.sha256"
  [[ $(wc -l < "$evidence/dependencies.sha256") -eq $(wc -l < "$evidence/dependencies.expected.sha256") ]] \
    || { printf '%s\n' 'Dependency download list does not match recorded SHA-256 sources' >&2; exit 1; }
  if [[ -s "$evidence/dependencies.expected.sha256" ]]; then
    sha256sum --check --strict "$evidence/dependencies.expected.sha256"
  fi
)
apt-get -y --no-download --no-install-recommends install "${packages[@]}"
dpkg-query -W -f='${binary:Package}\t${Version}\t${Architecture}\n' > "$evidence/packages.tsv"
apt-get clean
asset=$(jq -ce '.dependencies.artifacts[] | select(.id == "erlang")' "$recipe")
printf '%s\n' "$asset" > "$evidence/artifact.json"
build_dir=$(mktemp -d)
trap 'rm -rf -- "$build_dir"' EXIT
archive="$build_dir/erlang.tar.gz"
curl --fail --location --retry 3 --output "$archive" "$(jq -r '.url' <<< "$asset")"
printf '%s  %s\n' "$(jq -r '.sha256' <<< "$asset")" "$archive" | sha256sum --check --strict
tar -tzf "$archive" > "$evidence/source-archive-files.txt"
mkdir "$build_dir/source"
tar -xzf "$archive" -C "$build_dir/source" --strip-components=1
cd "$build_dir/source"
./configure --prefix=/opt/erlang --without-javac --without-wx --without-odbc \
  --without-termcap --disable-debug --disable-sctp
make -j "${BUILD_JOBS:-2}"
make install
rm -rf /var/lib/apt/lists/*

