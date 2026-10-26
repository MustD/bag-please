#!/usr/bin/env bash
# build.sh - build both images tagged with gradle.properties' version (and nothing else: never `latest`).
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
require_env DOCKER_IMAGE_BACK DOCKER_IMAGE_FRONT
version="$(read_version)"
require_version_chars "$version"
echo "Building version $version"
docker build -f "$ROOT/bp_back/Dockerfile" -t "$DOCKER_IMAGE_BACK:$version" "$ROOT"
docker build -f "$ROOT/bp_front/Dockerfile" -t "$DOCKER_IMAGE_FRONT:$version" "$ROOT"
