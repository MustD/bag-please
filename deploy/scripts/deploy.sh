#!/usr/bin/env bash
# deploy.sh [<version>] - roll a version onto the droplet. No argument: the gradle.properties version is new, so run the
# backend tests, build and push it. With <version> (also the rollback): that tag must already be on Docker Hub; nothing
# is tested, built or pushed. Then, in both cases: .env (secrets, over ssh stdin only), the CA and the compose file are
# written on the droplet, images pulled, `up -d --wait`, and /api/health is smoke-tested through the edge.
# Never runs Terraform and never rolls back by itself: on failure it prints the rollback command.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
require_env TF_STATE_BUCKET AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY EDGE_SSH KTOR_JWT_SECRET KTOR_ADMIN_LOGIN KTOR_ADMIN_PASS \
	DOCKER_IMAGE_BACK DOCKER_IMAGE_FRONT
# Not needed here; and the runtime secrets stay shell variables of this script, so no child process (git, docker,
# terraform, ssh) inherits them - they reach the droplet as ssh stdin only.
unset DIGITALOCEAN_TOKEN
export -n KTOR_JWT_SECRET KTOR_ADMIN_LOGIN KTOR_ADMIN_PASS
keep_deploy_env_private
require_clean_tree

if [ -n "${1:-}" ]; then
	version="$1"
	require_version_chars "$version"
	require_tags_present "$version"
	fresh=""
else
	version="$(read_version)"
	require_version_chars "$version"
	require_tags_free "$version"
	fresh=1
fi

# Fail on an empty database output before anything is tested, built or pushed.
tf_init
load_runtime_outputs

# The version the droplet runs now, read before .env is overwritten (sed prints only that line, never a secret).
prev_cmd='sed -n "s/^BP_VERSION=//p" bag-please/.env'
previous="$(remote "$prev_cmd" </dev/null 2>/dev/null || true)"
previous="${previous//\'/}"
previous="${previous%%$'\n'*}"

TOUCHED=""
on_exit() {
	local rc=$?
	if [ "$rc" -ne 0 ]; then
		if [ -n "$TOUCHED" ]; then echo "deploy of $version failed." >&2
		else echo "deploy of $version failed before the droplet was touched (it is untouched)." >&2; fi
		echo "To go back to the previous version, run:" >&2
		echo "  mise run deploy -- ${previous:-<previous version>}" >&2
	fi
	exit "$rc"
}
trap on_exit EXIT

if [ -n "$fresh" ]; then
	echo "Running the backend tests"
	(unset_deploy; mise run back:test)
	# docker needs the image names and nothing else from the secure files.
	(unset_deploy_only; "$HERE/push.sh")
fi

# env_line <name> <value>: one dotenv line, single-quoted so nothing is expanded; a value that cannot be quoted
# (quote or newline) stops the deploy.
env_line() {
	local nl=$'\n'
	case "$2" in *\'* | *"$nl"*) echo "$1 contains a quote or newline - cannot be written to .env" >&2; exit 1 ;; esac
	printf "%s='%s'\n" "$1" "$2"
}
env_file="$(
	env_line BP_VERSION "$version"
	env_line DOCKER_IMAGE_BACK "$DOCKER_IMAGE_BACK"
	env_line DOCKER_IMAGE_FRONT "$DOCKER_IMAGE_FRONT"
	env_line PRIVATE_IP "$DROPLET_IP"
	env_line KTOR_DB_HOST "$DB_HOST"
	env_line KTOR_DB_PORT "$DB_PORT"
	env_line KTOR_DB_NAME "$DB_NAME"
	env_line KTOR_DB_USER "$DB_APP_USER"
	env_line KTOR_DB_PASSWORD "$DB_APP_PASSWORD"
	env_line KTOR_JWT_SECRET "$KTOR_JWT_SECRET"
	env_line KTOR_ADMIN_LOGIN "$KTOR_ADMIN_LOGIN"
	env_line KTOR_ADMIN_PASS "$KTOR_ADMIN_PASS"
)"

TOUCHED=1
echo "Deploying $version to $DROPLET_IP"
printf '%s\n' "$env_file" | remote 'umask 077 && mkdir -p bag-please && cat > bag-please/.env.new && chmod 600 bag-please/.env.new && mv bag-please/.env.new bag-please/.env'
printf '%s\n' "$DB_CA_CERTIFICATE" | remote 'umask 022 && cat > bag-please/ca-certificate.crt.new && chmod 644 bag-please/ca-certificate.crt.new && mv bag-please/ca-certificate.crt.new bag-please/ca-certificate.crt'
remote 'cat > bag-please/docker-compose.yml.new && mv bag-please/docker-compose.yml.new bag-please/docker-compose.yml' <"$ROOT/deploy/docker-compose.yml"
remote 'cd bag-please && docker compose pull && docker compose up -d --wait --remove-orphans' </dev/null
with_spaces_env "$HERE/smoke.sh"
echo "deployed $version"
