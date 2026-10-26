#!/usr/bin/env bash
# import.sh [<export-dir>] - load a mongoexport --jsonArray export into the production PostgreSQL (Story 11.8's
# importer) directly (the cluster's public host, verify-full; this machine's IP must be among the cluster's trusted sources). Refuses before any database connection: missing export (exit 2), dirty tree, backend running.
# A relative argument means the caller's directory: mise runs the task from the repo root and passes the caller's in
# MISE_ORIGINAL_CWD, and lib.sh changes into the repo root. The default is the repo root's migration-export/.
export_dir=""
if [ -n "${1:-}" ]; then
	export_dir="$(cd "${MISE_ORIGINAL_CWD:-.}" && realpath -m "$1")" || { echo "cannot resolve export directory: $1" >&2; exit 2; }
fi
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
export_dir="${export_dir:-$ROOT/migration-export}"
[ -d "$export_dir" ] || { echo "export directory not found: $export_dir" >&2; exit 2; }
require_env AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY EDGE_SSH
require_clean_tree
make_scratch
tf_init
load_db_outputs
if ! running="$(remote docker ps --filter name=bp_back --format '{{.Names}}')"; then
	echo "could not check whether bp_back runs on the droplet - refusing." >&2
	exit 1
fi
if [ -n "$running" ]; then
	echo "bp_back is running on the droplet ($running) - stop it before importing." >&2
	exit 1
fi
run_importer "$export_dir"
