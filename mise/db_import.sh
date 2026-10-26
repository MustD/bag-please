#!/usr/bin/env bash
# Load a `mongoexport --jsonArray` export into the LOCAL Compose PostgreSQL (Story 11.8).
# usage: mise run db:import:local [-- <export-dir>]   (default: migration-export/)
#
# The DB credentials are the local dev ones from docker-compose.yaml. They are set only as the environment of the
# `java` command below: never exported into this shell, never passed to Gradle, never written to a file.
set -euo pipefail

cd "$(dirname "$0")/.."

export_dir="${1:-migration-export}"
[ -d "$export_dir" ] || { echo "export directory not found: $export_dir" >&2; exit 2; }

if ! out="$(gradle :bp_back:importClasspath -q --console=plain 2>&1)"; then
    echo "gradle :bp_back:importClasspath failed:" >&2
    echo "$out" >&2
    exit 1
fi
classpath="$(printf '%s\n' "$out" | tail -n 1)"
[ -n "$classpath" ] || { echo "importClasspath printed an empty classpath" >&2; exit 1; }

IMPORT_DB_HOST=127.0.0.1 IMPORT_DB_PORT=25432 IMPORT_DB_NAME=bag_please \
IMPORT_DB_USER=bag_please_app IMPORT_DB_PASSWORD=bag_please_app IMPORT_DB_SSLMODE=disable \
    java -cp "$classpath" com.bagplease.tools.MongoImport "$export_dir"
