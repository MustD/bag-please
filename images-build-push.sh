#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/project.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: $ENV_FILE not found. Copy project.example.env and fill in your image names."
  exit 1
fi

# shellcheck source=project.env
source "$ENV_FILE"

VERSION=$(grep '^version=' "$SCRIPT_DIR/gradle.properties" | cut -d'=' -f2)
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
  -f bp_back/Dockerfile \
  -t "$DOCKER_IMAGE_BACK:$VERSION" \
  -t "$DOCKER_IMAGE_BACK:latest" \
  .

docker build \
  -f bp_front/Dockerfile \
  -t "$DOCKER_IMAGE_FRONT:$VERSION" \
  -t "$DOCKER_IMAGE_FRONT:latest" \
  .

echo "Pushing version $VERSION"

for IMAGE in "$DOCKER_IMAGE_BACK" "$DOCKER_IMAGE_FRONT"; do
  docker push "$IMAGE:$VERSION"
  docker push "$IMAGE:latest"
done

echo "Done: $DOCKER_IMAGE_BACK:$VERSION, $DOCKER_IMAGE_FRONT:$VERSION"
