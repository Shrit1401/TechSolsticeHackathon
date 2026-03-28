#!/usr/bin/env sh
set -e
M=$(uname -m)
case "$M" in
  x86_64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) echo "unsupported arch: $M"; exit 1 ;;
esac
VER=v0.19.3
NAME="buildx-${VER}.linux-${ARCH}"
URL="https://github.com/docker/buildx/releases/download/${VER}/${NAME}"
mkdir -p "${HOME}/.docker/cli-plugins"
curl -fsSL "$URL" -o "${HOME}/.docker/cli-plugins/docker-buildx"
chmod +x "${HOME}/.docker/cli-plugins/docker-buildx"
docker buildx version
