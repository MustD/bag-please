#!/usr/bin/env bash
# shellcheck disable=SC2034
# Sourced by the deploy tasks. Reads what mise loaded and checks what the caller needs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

# mise loads .secure.deploy.env per task (see mise.toml); this only checks that what the caller needs arrived, so an
# unfilled file fails here and not three steps in.
require_env() {
	local v
	for v in "$@"; do
		[ -n "${!v:-}" ] || { echo "$v is empty - set it in .secure.deploy.env (run through mise)." >&2; exit 1; }
	done
}

# Drop every variable from .secure.deploy.env from THIS process. Call it inside a subshell, right before a command
# that has no use for them (Gradle, with its daemon and plugins; java; psql), so it never sees them.
unset_deploy() {
	local v
	unset DIGITALOCEAN_TOKEN AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY EDGE_SSH PG_ADMIN_USER PG_ADMIN_PASSWORD
	for v in $(compgen -e); do
		if [[ $v == TF_VAR_* ]]; then unset "$v"; fi
	done
}

# terraform output reads the S3 state with the Spaces key alone, so the DigitalOcean token and the cluster admin's
# credentials are dropped.
tf() { (cd deploy/terraform && unset DIGITALOCEAN_TOKEN PG_ADMIN_USER PG_ADMIN_PASSWORD && terraform "$@"); }
tf_init() { tf init -input=false >/dev/null; }
tf_out() { tf output -raw "$1"; }

droplet_ip() { tf_out private_ip; }

# ssh through the edge as a jump host, so a recreated droplet needs no ~/.ssh/config edit.
remote() { ssh "${SSH_OPTS[@]}" -J "$EDGE_SSH" "deploy@$DROPLET_IP" "$@"; }

# Refuse unless the working tree is clean: the importer that runs is the committed one.
require_clean_tree() {
	if [ -n "$(git status --porcelain)" ]; then
		echo "working tree is not clean - commit or stash first." >&2
		exit 1
	fi
}

# Scratch dir for the CA file and the empty export; removed on exit.
SCRATCH=""
make_scratch() { SCRATCH="$(mktemp -d)"; }

cleanup() {
	if [ -n "$SCRATCH" ]; then rm -rf "$SCRATCH"; fi
}
trap cleanup EXIT

# run_importer <export-dir>: the Story 11.8 importer against the shared cluster's public host, as bag_please_app (verify-full). The credentials are the
# environment of the one `java` command; Gradle gets none of the deploy variables.
run_importer() {
	local export_dir="$1" out classpath
	if ! out="$( (unset_deploy; gradle :bp_back:importClasspath -q --console=plain) 2>&1)"; then
		echo "gradle :bp_back:importClasspath failed:" >&2
		echo "$out" >&2
		exit 1
	fi
	classpath="$(printf '%s\n' "$out" | tail -n 1)"
	[ -n "$classpath" ] || { echo "importClasspath printed an empty classpath" >&2; exit 1; }
	(
		unset_deploy
		IMPORT_DB_HOST="$DB_PUBLIC_HOST" IMPORT_DB_PORT="$DB_PORT" IMPORT_DB_NAME="$DB_NAME" \
			IMPORT_DB_USER="$DB_APP_USER" IMPORT_DB_PASSWORD="$DB_APP_PASSWORD" \
			IMPORT_DB_SSLMODE=verify-full IMPORT_DB_SSLROOTCERT="$SCRATCH/ca.pem" \
			java -cp "$classpath" com.bagplease.tools.MongoImport "$export_dir"
	)
}

# load_db_outputs: the cluster coordinates and the app credentials, from Terraform state, into shell variables of
# this script only (never exported).
load_db_outputs() {
	DROPLET_IP="$(need_out private_ip)"
	DB_PUBLIC_HOST="$(need_out db_public_host)"
	DB_PORT="$(need_out db_port)"
	DB_NAME="$(need_out db_name)"
	DB_APP_USER="$(need_out db_app_user)"
	DB_APP_PASSWORD="$(need_out db_app_password)"
	need_out db_ca_certificate >"$SCRATCH/ca.pem"
}

# need_out <name>: a Terraform output that must be set; an empty or null one stops the script naming it.
need_out() {
	local v
	v="$(tf_out "$1")" || { echo "terraform output $1 failed (applied? .secure.deploy.env right?)" >&2; exit 1; }
	if [ -z "$v" ] || [ "$v" = null ]; then
		echo "terraform output $1 is empty - has infra:apply run?" >&2
		exit 1
	fi
	printf '%s' "$v"
}

# load_admin: the cluster admin's credentials from .secure.deploy.env, moved into unexported shell variables of this
# script, so no child process (git, terraform, gradle, java) inherits them and only the bootstrap psql gets the
# password, as PGPASSWORD. Used by db:bootstrap alone.
load_admin() {
	ADMIN_USER="$PG_ADMIN_USER"
	ADMIN_PASSWORD="$PG_ADMIN_PASSWORD"
	unset PG_ADMIN_USER PG_ADMIN_PASSWORD
}
