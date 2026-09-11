#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/project.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found. Copy project.example.env and fill in your image names."
  exit 1
fi

# shellcheck source=/dev/null
source "$ENV_FILE"

VERSION=$(grep '^version=' "$ROOT_DIR/gradle.properties" | cut -d'=' -f2)
if [[ -z "$VERSION" ]]; then
  echo "Error: could not read version from gradle.properties"
  exit 1
fi

if ! docker info --format '{{.RegistryConfig.IndexConfigs}}' 2>/dev/null | grep -q 'docker.io'; then
  echo "Error: not logged in to Docker Hub. Run: docker login"
  exit 1
fi

echo "Building version $VERSION"

docker build \
  -f "$ROOT_DIR/bp_back/Dockerfile" \
  -t "$DOCKER_IMAGE_BACK:$VERSION" \
  -t "$DOCKER_IMAGE_BACK:latest" \
  "$ROOT_DIR"

docker build \
  -f "$ROOT_DIR/bp_front/Dockerfile" \
  -t "$DOCKER_IMAGE_FRONT:$VERSION" \
  -t "$DOCKER_IMAGE_FRONT:latest" \
  "$ROOT_DIR"

echo "Pushing version $VERSION"

for IMAGE in "$DOCKER_IMAGE_BACK" "$DOCKER_IMAGE_FRONT"; do
  docker push "$IMAGE:$VERSION"
  docker push "$IMAGE:latest"
done

echo "Done: $DOCKER_IMAGE_BACK:$VERSION, $DOCKER_IMAGE_FRONT:$VERSION"
