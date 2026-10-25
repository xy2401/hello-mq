#!/usr/bin/env bash
set -Eeuo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
tools=${HELLO_DOCKER_HOME:-}
images=
workspace=
site=
while (($#)); do
  case "$1" in
    --tools) tools=${2:?}; shift 2 ;;
    --images) images=${2:?}; shift 2 ;;
    --workspace) workspace=${2:?}; shift 2 ;;
    --site) site=${2:?}; shift 2 ;;
    *) printf 'Usage: capture.sh --tools <hello-docker> --images <build/images.json> --workspace <new-directory> [--site <bundle-directory>]\n' >&2; exit 2 ;;
  esac
done
: "${tools:?Pass --tools or HELLO_DOCKER_HOME explicitly}"
: "${images:?Pass --images from a completed build}"
: "${workspace:?Pass --workspace for this capture batch}"
test -f "$tools/scripts/capture/run.sh"
stage_lines=$(node --input-type=module - "$images" "$here/recipe.json" <<'NODE'
import fs from 'node:fs';
import crypto from 'node:crypto';
const [file, recipeFile] = process.argv.slice(2);
const record = JSON.parse(fs.readFileSync(file, 'utf8'));
const recipe = JSON.parse(fs.readFileSync(recipeFile, 'utf8'));
if (record.recipeSha256 !== crypto.createHash('sha256').update(fs.readFileSync(recipeFile)).digest('hex')) throw new Error('Recipe changed since the image build');
if (!['podman', 'docker'].includes(record.engine)) throw new Error('Invalid recorded engine');
console.log(record.engine);
for (const expected of recipe.stages) {
  const stage = record.stages.find(item => item.id === expected.id);
  if (!stage || !/^(sha256:)?[a-f0-9]{64}$/.test(stage.image)) throw new Error(`Missing immutable image ID for ${expected.id}`);
  console.log(`${stage.id}=${stage.image}`);
}
NODE
)
mapfile -t entries <<< "$stage_lines"
export ENGINE=${entries[0]}
args=(--recipe "$here/recipe.json" --workspace "$workspace")
for entry in "${entries[@]:1}"; do args+=(--stage "$entry"); done
if [[ -n "$site" ]]; then args+=(--site "$site"); fi
bash "$tools/scripts/capture/run.sh" "${args[@]}"
