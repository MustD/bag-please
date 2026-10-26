#!/usr/bin/env bash
# shellcheck disable=SC2034
# Sourced by the deploy tasks. Reads what mise loaded and checks what the caller needs.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=accept-new)

PUBLIC_URL="https://bag-please.io-workshop.net/"

# mise loads .secure.deploy.env / .secure.build.env per task (see mise.toml); this only checks that what the caller
# needs arrived, so an unfilled file fails here and not three steps in.
require_env() {
	local v
	for v in "$@"; do
		[ -n "${!v:-}" ] || { echo "$v is empty - set it in .secure.deploy.env or .secure.build.env (run through mise)." >&2; exit 1; }
	done
}

# Names of every variable the two committed examples declare (uncommented NAME= lines), one per line.
secure_names() {
	grep -hoE '^[A-Z][A-Z0-9_]*=' "$ROOT/.secure.deploy.env.example" "$ROOT/.secure.build.env.example" | tr -d '=' || true
}

# Drop every variable from the .secure.*.env files from THIS process: the names the two examples declare, plus any
# TF_VAR_* and KTOR_* in the environment. Call it inside a subshell, right before a command that has no use for them
# (mise, and the Gradle it starts), so it never sees them.
unset_deploy() {
	local v
	for v in $(secure_names) $(compgen -e | grep -E '^(TF_VAR_|KTOR_)' || true); do
		unset "$v"
	done
}

# Like unset_deploy but keeps .secure.build.env's variables (the image names): for docker build and push, which need
# those and nothing else.
unset_deploy_only() {
	local v
	for v in $(grep -hoE '^[A-Z][A-Z0-9_]*=' "$ROOT/.secure.deploy.env.example" | tr -d '=' || true) \
		$(compgen -e | grep -E '^(TF_VAR_|KTOR_)' || true); do
		unset "$v"
	done
}

# Keep the Spaces key, the edge address and TF_VAR_* as shell variables of this script only, so git, ssh, docker and
# curl never inherit them; tf() re-exports the Spaces key for terraform alone. A child script that needs them
# (smoke.sh) gets them through with_spaces_env.
keep_deploy_env_private() {
	local v
	export -n AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY EDGE_SSH TF_STATE_BUCKET
	for v in $(compgen -e | grep -E '^TF_VAR_' || true); do export -n "$v"; done
}
with_spaces_env() {
	AWS_ACCESS_KEY_ID="$AWS_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$AWS_SECRET_ACCESS_KEY" EDGE_SSH="$EDGE_SSH" \
		TF_STATE_BUCKET="$TF_STATE_BUCKET" "$@"
}

# terraform output reads the S3 state with the Spaces key alone, so the DigitalOcean token is dropped.
tf() { (cd deploy/terraform && unset DIGITALOCEAN_TOKEN && export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY && terraform "$@"); }
# The state bucket's name is not committed (versions.tf): it comes from TF_STATE_BUCKET.
tf_init() { tf init -input=false -backend-config="bucket=$TF_STATE_BUCKET" >/dev/null; }
tf_out() { tf output -raw "$1"; }

droplet_ip() { tf_out private_ip; }

# ssh through the edge as a jump host, so a recreated droplet needs no ~/.ssh/config edit.
remote() { ssh "${SSH_OPTS[@]}" -J "$EDGE_SSH" "deploy@$DROPLET_IP" "$@"; }

# Refuse unless the working tree is clean: what is released is the committed tree.
require_clean_tree() {
	if [ -n "$(git status --porcelain)" ]; then
		echo "working tree is not clean - commit or stash first." >&2
		exit 1
	fi
}

# The version being released: gradle.properties' `version`.
read_version() {
	local v
	v="$(sed -n 's/^version=//p' "$ROOT/gradle.properties" | head -n 1)"
	[ -n "$v" ] || { echo "could not read version from gradle.properties" >&2; exit 1; }
	printf '%s' "$v"
}

# A version becomes an image tag and a line of the droplet's .env: keep it to the characters a tag allows.
require_version_chars() {
	[[ $1 =~ ^[0-9A-Za-z][0-9A-Za-z._-]*$ && $1 != latest ]] || { echo "invalid version: $1" >&2; exit 1; }
}

# tag_state <image> <tag>: prints present|absent. Docker Hub silently overwrites a pushed tag, so anything but a clear
# "no such manifest" (network, auth, rate limit) is not "absent": refuse.
tag_state() {
	local out
	if out="$(docker manifest inspect "$1:$2" 2>&1)"; then
		echo present
	elif [[ $out == *"no such manifest"* ]]; then
		echo absent
	else
		echo "cannot query Docker Hub for $1:$2: $out" >&2
		return 1
	fi
}

# require_tags_free <version>: neither image has the tag yet.
require_tags_free() {
	local img state
	for img in "$DOCKER_IMAGE_BACK" "$DOCKER_IMAGE_FRONT"; do
		state="$(tag_state "$img" "$1")" || exit 1
		if [ "$state" = present ]; then
			echo "$img:$1 is already published - bump gradle.properties' version, or roll onto it with: mise run deploy -- $1" >&2
			exit 1
		fi
	done
}

# require_tags_present <version>: both images already have the tag.
require_tags_present() {
	local img state
	for img in "$DOCKER_IMAGE_BACK" "$DOCKER_IMAGE_FRONT"; do
		state="$(tag_state "$img" "$1")" || exit 1
		[ "$state" = present ] || { echo "$img:$1 is not published - run: mise run deploy:push, or deploy without a version." >&2; exit 1; }
	done
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

# load_runtime_outputs: what the droplet's .env needs, from Terraform state, into shell variables of this script only.
# The droplet reaches the database over the cluster's PRIVATE host. An empty or null output stops the script naming it.
load_runtime_outputs() {
	DROPLET_IP="$(need_out private_ip)"
	DB_HOST="$(need_out db_host)"
	DB_PORT="$(need_out db_port)"
	DB_NAME="$(need_out db_name)"
	DB_APP_USER="$(need_out db_app_user)"
	DB_APP_PASSWORD="$(need_out db_app_password)"
	DB_CA_CERTIFICATE="$(need_out db_ca_certificate)"
}
