#!/usr/bin/env bash
# smoke.sh - from the edge (the one host the droplet's firewall lets in), GET http://<droplet private ip>/api/health and
# require the body `OK`. A few retries: the backend may still be warming up after `up --wait`.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
require_env AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY EDGE_SSH
tf_init
DROPLET_IP="$(need_out private_ip)"
body=""
for attempt in 1 2 3 4 5; do
	if body="$(ssh "${SSH_OPTS[@]}" "$EDGE_SSH" curl -fsS --max-time 10 "http://$DROPLET_IP/api/health" 2>/dev/null)" && [ "$body" = OK ]; then
		echo "smoke test passed: http://$DROPLET_IP/api/health = OK (via the edge)"
		exit 0
	fi
	echo "smoke attempt $attempt/5 failed (got: ${body:-nothing})" >&2
	sleep "${SMOKE_SLEEP:-4}"
done
echo "smoke test failed: http://$DROPLET_IP/api/health did not answer OK via $EDGE_SSH" >&2
exit 1
