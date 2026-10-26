#!/usr/bin/env bash
# push.sh - refuse a dirty tree or a tag that is already on Docker Hub (Hub silently overwrites a pushed tag), then
# build and push both images as :<gradle.properties version>. Never `latest`.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
require_env DOCKER_IMAGE_BACK DOCKER_IMAGE_FRONT
require_clean_tree
version="$(read_version)"
require_version_chars "$version"
require_tags_free "$version"
"$(dirname "$0")/build.sh"
echo "Pushing version $version"
for img in "$DOCKER_IMAGE_BACK" "$DOCKER_IMAGE_FRONT"; do
	docker push "$img:$version"
done
echo "Pushed $DOCKER_IMAGE_BACK:$version and $DOCKER_IMAGE_FRONT:$version"
