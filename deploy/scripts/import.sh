#!/usr/bin/env bash
# import.sh [<export-dir>] - load a mongoexport --jsonArray export into the production PostgreSQL (Story 11.8's
# importer) directly (the cluster's public host, verify-full; this machine's IP must be in the hub's admin_cidrs). Refuses before any database connection: missing export (exit 2), dirty tree, backend running.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
export_dir="${1:-migration-export}"
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
