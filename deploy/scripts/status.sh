#!/usr/bin/env bash
# status.sh - the version(s) running on the droplet and the public URL's HTTP status. A dead droplet is reported, and
# the HTTP status is still printed (exit 1 then).
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
require_env AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY EDGE_SSH
unset DIGITALOCEAN_TOKEN PG_ADMIN_USER PG_ADMIN_PASSWORD
tf_init
DROPLET_IP="$(need_out private_ip)"
rc=0
if running="$(remote "cd bag-please && docker compose ps --format '{{.Service}} {{.Image}}'" </dev/null)"; then
	echo "running on the droplet ($DROPLET_IP):"
	if [ -n "$running" ]; then printf '%s\n' "$running"; else echo "  (no containers)"; fi
else
	echo "droplet $DROPLET_IP is unreachable (or has no deployment) - cannot read the running version" >&2
	echo "droplet unreachable"
	rc=1
fi
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$PUBLIC_URL" || true)"
echo "$PUBLIC_URL -> HTTP ${code:-000}"
exit "$rc"
