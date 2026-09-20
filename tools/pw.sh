#!/usr/bin/env bash
# Runs a harness script (tools/*.mjs) inside the official Playwright container attached to the
# Docker network of the Jellyfin test container ("jellyflix-test" on network "jfnet").
# Why a container: on this dev host some Windows processes cannot reach Docker-published ports,
# while container-to-container traffic is reliable.
#   tools/pw.sh tools/dom.mjs --route home --selector .homeSectionsContainer
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && (pwd -W 2>/dev/null || pwd))"
PW_VERSION="$(cd "$ROOT" && node -p "require('playwright-core/package.json').version")"
SCRIPT="$1"; shift
MSYS_NO_PATHCONV=1 docker run --rm --network jfnet --ipc=host \
  -v "$ROOT:/work" -w /work \
  -e JF_URL=http://jellyflix-test:8096 -e PW_CHANNEL= \
  "mcr.microsoft.com/playwright:v${PW_VERSION}-noble" \
  node "$SCRIPT" "$@"
