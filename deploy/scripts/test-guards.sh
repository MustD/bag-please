#!/usr/bin/env bash
# Runs the infra, push, deploy and status guard rows (Stories 11.9, 11.10) against the real scripts with stubbed
# terraform/ssh/git/docker/mise/curl on PATH, and asserts the refusal, the exit code and where secrets may go.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
REAL_DOCKER="$(command -v docker || true)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
# Start from none of the real .secure.*.env values (mise may have loaded them for a dependent task): every case sets
# what it needs.
for v in $(grep -hoE '^[A-Z][A-Z0-9_]*=' "$HERE/../../.secure.deploy.env.example" "$HERE/../../.secure.build.env.example" | tr -d '=') \
	$(compgen -e | grep -E '^(TF_VAR_|KTOR_)' || true); do
	unset "$v"
done
mkdir "$WORK/bin"
export SSH_LOG="$WORK/ssh.log"

cat >"$WORK/bin/terraform" <<'STUB'
#!/usr/bin/env bash
env >>"$WORK_LOG/terraform.env"
echo "$*" >>"$WORK_LOG/terraform.args"
if [ "$1" = output ]; then
	if [ "${3:-}" = "${STUB_EMPTY_OUTPUT:-}" ]; then exit 0; fi
	echo "stub-${3:-x}"
fi
exit 0
STUB
cat >"$WORK/bin/ssh" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$SSH_LOG"
env >>"$WORK_LOG/ssh.env"
cat >>"$WORK_LOG/ssh.stdin"
[ -z "${STUB_SSH_DEAD:-}" ] || exit 255
if [ -n "${STUB_SSH_FAIL:-}" ] && [[ "$*" == *"$STUB_SSH_FAIL"* ]]; then exit 1; fi
case "$*" in
	*'BP_VERSION=//p'*) [ -z "${STUB_PREV:-}" ] || printf '%s\n' "$STUB_PREV" ;;
	*"compose ps"*) printf '%s' "${STUB_COMPOSE_PS:-}" ;;
	*"/api/health"*) printf '%s' "${STUB_HEALTH:-OK}" ;;
esac
exit 0
STUB
cat >"$WORK/bin/git" <<'STUB'
#!/usr/bin/env bash
env >>"$WORK_LOG/git.env"
if [ "$1" = status ]; then printf '%s' "${STUB_DIRTY:-}"; fi
exit 0
STUB
cat >"$WORK/bin/docker" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$WORK_LOG/docker.log"
case "$1" in build | push) env >>"$WORK_LOG/docker.env" ;; *) env >>"$WORK_LOG/docker.other.env" ;; esac
if [ "$1 $2" = "manifest inspect" ]; then
	if [ -n "${STUB_HUB_ERROR:-}" ]; then echo "unauthorized: authentication required" >&2; exit 1; fi
	for p in ${STUB_TAGS_PRESENT:-}; do [[ "$3" == *"$p"* ]] && { echo '{}'; exit 0; }; done
	echo "no such manifest: docker.io/$3" >&2
	exit 1
fi
exit 0
STUB
cat >"$WORK/bin/mise" <<'STUB'
#!/usr/bin/env bash
[ -z "${STUB_TEST_FAIL:-}" ] || { echo "tests failed" >&2; exit 1; }
env >"$WORK_LOG/mise.env"
echo "$*" >>"$WORK_LOG/mise.log"
STUB
cat >"$WORK/bin/curl" <<'STUB'
#!/usr/bin/env bash
printf '%s' "${STUB_HTTP:-200}"
STUB
export WORK_LOG="$WORK"
chmod +x "$WORK/bin/"*

fails=0
# case <name> <expected-exit> <expected-stderr-substring> <env assignments...> -- <script> [args]
run_case() {
	local name="$1" want="$2" msg="$3" rc err; shift 3
	local -a envs=()
	while [ "$1" != -- ]; do envs+=("$1"); shift; done
	shift
	: >"$SSH_LOG"
	err="$(env PATH="$WORK/bin:$PATH" TF_STATE_BUCKET=b AWS_ACCESS_KEY_ID=k AWS_SECRET_ACCESS_KEY=s EDGE_SSH=u@h "${envs[@]}" "$@" 2>&1 >/dev/null </dev/null)"
	rc=$?
	if [ "$rc" != "$want" ]; then echo "FAIL $name: exit $rc, wanted $want ($err)"; fails=$((fails + 1)); return; fi
	if [[ $err != *"$msg"* ]]; then echo "FAIL $name: stderr lacks '$msg' ($err)"; fails=$((fails + 1)); return; fi
	echo "ok   $name"
}

run_case "missing secret" 1 "DIGITALOCEAN_TOKEN is empty" DIGITALOCEAN_TOKEN= -- "$HERE/infra.sh" plan

# Every variable a script require_env's is in .secure.deploy.env.example, and the example carries no value.
missing=""
# (sed joins backslash-continued require_env lines first.)
for v in $(sed -e ':a' -e '/\\$/{N;s/\\\n//;ba}' "$HERE"/*.sh | sed -n 's/^require_env //p' | tr -s ' \t' '\n' | sort -u); do
	grep -q "^$v=$" "$HERE/../../.secure.deploy.env.example" "$HERE/../../.secure.build.env.example" || missing="$missing $v"
done
if [ -n "$missing" ]; then echo "FAIL env example: missing or filled in:$missing"; fails=$((fails + 1))
elif grep -qE '^[A-Z_]+=.+' "$HERE/../../.secure.deploy.env.example" "$HERE/../../.secure.build.env.example"; then echo "FAIL env example: a variable has a value"; fails=$((fails + 1))
else echo "ok   env example"; fi

LEAK='^(DIGITALOCEAN_TOKEN|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|EDGE_SSH|TF_VAR_[A-Za-z_]*|KTOR_[A-Za-z_]*|DOCKER_IMAGE_[A-Z]*)='

# infra: terraform gets the token and TF_VAR_*.
: >"$WORK/terraform.env"
: >"$WORK/terraform.args"
if ! env PATH="$WORK/bin:$PATH" TF_STATE_BUCKET=b AWS_ACCESS_KEY_ID=k AWS_SECRET_ACCESS_KEY=s DIGITALOCEAN_TOKEN=t TF_VAR_edge_private_ip=1.2.3.4 \
	TF_VAR_vpc_name=v TF_VAR_ssh_key_name=k TF_VAR_pg_cluster_name=c TF_VAR_pg_client_tag=t \
	"$HERE/infra.sh" plan >/dev/null 2>&1 </dev/null; then
	echo "FAIL infra: infra.sh plan exited non-zero"; fails=$((fails + 1))
elif ! grep -q '^DIGITALOCEAN_TOKEN=t$' "$WORK/terraform.env"; then
	echo "FAIL infra: terraform lacks the token"; fails=$((fails + 1))
elif ! grep -q '^init -input=false -backend-config=bucket=b$' "$WORK/terraform.args"; then
	echo "FAIL infra: terraform init lacks the state bucket from TF_STATE_BUCKET"; fails=$((fails + 1))
else
	echo "ok   infra"
fi

# --- Story 11.10: build, push, deploy, status ---------------------------------------------------------------------
reset_logs() { for f in docker.log docker.env docker.other.env ssh.env mise.log ssh.stdin terraform.args terraform.env git.env mise.env; do : >"$WORK/$f"; done; : >"$SSH_LOG"; }
fail() { echo "FAIL $1"; fails=$((fails + 1)); }
DEP=(DOCKER_IMAGE_BACK=hub/back DOCKER_IMAGE_FRONT=hub/front KTOR_JWT_SECRET=jwt-secret-value KTOR_ADMIN_LOGIN=admin-login-value
	KTOR_ADMIN_PASS=admin-pass-value SMOKE_SLEEP=0 DIGITALOCEAN_TOKEN=t TF_VAR_vpc_name=v)
VERSION="$(sed -n 's/^version=//p' "$HERE/../../gradle.properties")"
# deploy_case <name> <expected-exit> <stderr-substring> <env...> -- <script> [args]: like run_case, with the deploy env and
# the logs reset first; the logs stay for the assertions that follow.
deploy_case() { local name="$1" want="$2" msg="$3"; shift 3; reset_logs; run_case "$name" "$want" "$msg" "${DEP[@]}" "$@"; }
no_network() { [ ! -s "$WORK/docker.log" ] && [ ! -s "$SSH_LOG" ] && [ ! -s "$WORK/mise.log" ]; }

deploy_case "push refuses dirty tree" 1 "working tree is not clean" STUB_DIRTY=" M f" -- "$HERE/push.sh"
no_network || fail "push dirty tree: docker/ssh/mise was called"
deploy_case "deploy refuses dirty tree" 1 "working tree is not clean" STUB_DIRTY=" M f" -- "$HERE/deploy.sh"
no_network || fail "deploy dirty tree: a network/docker call happened"
deploy_case "deploy <version> refuses dirty tree" 1 "working tree is not clean" STUB_DIRTY=" M f" -- "$HERE/deploy.sh" 0.1.0
no_network || fail "deploy <version> dirty tree: a network/docker call happened"

deploy_case "push, tag exists" 1 "hub/back:$VERSION is already published" STUB_TAGS_PRESENT=hub/back -- "$HERE/push.sh"
if grep -qE '^(build|push) ' "$WORK/docker.log"; then fail "push, tag exists: something was built or pushed"; fi
deploy_case "push, front tag exists" 1 "hub/front:$VERSION is already published" STUB_TAGS_PRESENT=hub/front -- "$HERE/push.sh"
if grep -qE '^(build|push) ' "$WORK/docker.log"; then fail "push, front tag exists: something was built or pushed"; fi
deploy_case "push, hub unreachable" 1 "cannot query" STUB_HUB_ERROR=1 -- "$HERE/push.sh"
if grep -qE '^(build|push) ' "$WORK/docker.log"; then fail "push, hub unreachable: something was built or pushed"; fi

deploy_case "push, tag free" 0 "" -- "$HERE/push.sh"
if [ "$(grep -c '^build ' "$WORK/docker.log")" -ne 2 ] || ! grep -q "^push hub/back:$VERSION\$" "$WORK/docker.log" \
	|| ! grep -q "^push hub/front:$VERSION\$" "$WORK/docker.log"; then
	fail "push, tag free: docker calls were $(tr '\n' ';' <"$WORK/docker.log")"
elif grep -q latest "$WORK/docker.log"; then fail "push: a latest tag appeared in a docker call"; fi

# deploy <version> (also the rollback): no test, no build, no push; the same remote steps.
deploy_case "deploy <version>, tag absent" 1 "hub/back:0.1.0 is not published" -- "$HERE/deploy.sh" 0.1.0
[ ! -s "$SSH_LOG" ] || fail "deploy <version>, tag absent: the droplet was contacted"
deploy_case "deploy <version>" 0 "" STUB_TAGS_PRESENT=hub/ -- "$HERE/deploy.sh" 0.1.0
if [ -s "$WORK/mise.log" ] || grep -qE '^(build|push) ' "$WORK/docker.log"; then fail "deploy <version>: tested, built or pushed"
elif ! grep -q "BP_VERSION='0.1.0'" "$WORK/ssh.stdin" || ! grep -q 'compose pull' "$SSH_LOG" || ! grep -q 'up -d --wait' "$SSH_LOG"; then
	fail "deploy <version>: remote steps missing"
elif grep -qE '^(DIGITALOCEAN_TOKEN|KTOR_JWT_SECRET)=' "$WORK/terraform.env" "$WORK/git.env"; then fail "deploy <version>: the DigitalOcean token or a runtime secret reached terraform or git"
else echo "ok   deploy <version> steps"; fi

# deploy, new version
deploy_case "deploy, new version" 0 "" STUB_PREV="'0.20.0'" -- "$HERE/deploy.sh"
if ! grep -q '^run back:test$' "$WORK/mise.log"; then fail "deploy: back:test was not run"
elif [ "$(grep -c '^build ' "$WORK/docker.log")" -ne 2 ] || ! grep -q "^push hub/back:$VERSION\$" "$WORK/docker.log"; then fail "deploy: images not built/pushed"
elif grep -q latest "$WORK/docker.log"; then fail "deploy: a latest tag appeared in a docker call"
elif grep -qE "$LEAK" "$WORK/mise.env"; then fail "deploy: a deploy/KTOR/image variable leaked into the nested mise task"
elif grep -E "$LEAK" "$WORK/docker.env" | grep -qv '^DOCKER_IMAGE_'; then fail "deploy: a deploy/KTOR variable leaked into docker build/push"
elif grep -qE 'apply|destroy' "$WORK/terraform.args"; then fail "deploy: terraform apply/destroy was run"
elif grep -qE 'jwt-secret-value|admin-pass-value|admin-login-value|stub-db_app_password' "$SSH_LOG"; then fail "deploy: a secret reached ssh argv"
elif ! grep -q "BP_VERSION='$VERSION'" "$WORK/ssh.stdin" || ! grep -q "KTOR_DB_PASSWORD='stub-db_app_password'" "$WORK/ssh.stdin" \
	|| ! grep -q "KTOR_DB_HOST='stub-db_host'" "$WORK/ssh.stdin" || ! grep -q "KTOR_JWT_SECRET='jwt-secret-value'" "$WORK/ssh.stdin" \
	|| ! grep -q "PRIVATE_IP='stub-private_ip'" "$WORK/ssh.stdin" || ! grep -q "DOCKER_IMAGE_BACK='hub/back'" "$WORK/ssh.stdin"; then
	fail "deploy: .env content missing from ssh stdin"
elif ! grep -q 'KTOR_DB_SSLMODE: verify-full' "$WORK/ssh.stdin" || ! grep -q 'stub-db_ca_certificate' "$WORK/ssh.stdin"; then fail "deploy: compose file or CA not sent over stdin"
elif ! grep -q 'umask 077 .*chmod 600 bag-please/.env.new && mv bag-please/.env.new bag-please/.env' "$SSH_LOG"; then fail "deploy: .env not written via umask 077, chmod 600, temp file + mv"
elif ! grep -q 'umask 022 .*chmod 644 bag-please/ca-certificate.crt.new' "$SSH_LOG"; then fail "deploy: CA not written mode 644"
elif ! grep -q 'curl -fsS' "$SSH_LOG"; then fail "deploy: no smoke test"
else echo "ok   deploy, new version"; fi
# The Spaces key, the edge address, the bucket and TF_VAR_* reach terraform only; the bucket arrives as backend config.
PRIVATE='^(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|EDGE_SSH|TF_STATE_BUCKET|TF_VAR_[A-Za-z_]*)='
if grep -qE "$PRIVATE" "$WORK/git.env" "$WORK/ssh.env" "$WORK/docker.other.env"; then
	fail "deploy: the Spaces key, EDGE_SSH, TF_STATE_BUCKET or a TF_VAR_ reached git, ssh or docker"
elif ! grep -q '^AWS_ACCESS_KEY_ID=k$' "$WORK/terraform.env"; then fail "deploy: terraform lost the Spaces key"
elif ! grep -q '^init -input=false -backend-config=bucket=b$' "$WORK/terraform.args"; then fail "deploy: terraform init lacks the state bucket"
else echo "ok   deploy keeps the Spaces key to terraform"; fi
deploy_case "deploy, back:test fails" 1 "mise run deploy -- 0.20.2" STUB_TEST_FAIL=1 STUB_PREV="'0.20.2'" -- "$HERE/deploy.sh"
if grep -qE '^(build|push) ' "$WORK/docker.log" || [ -s "$WORK/ssh.stdin" ]; then fail "deploy, back:test fails: built, pushed or wrote to the droplet"; fi
deploy_case "deploy, back:test fails says untouched" 1 "it is untouched" STUB_TEST_FAIL=1 -- "$HERE/deploy.sh"
deploy_case "deploy, smoke test fails" 1 "smoke test failed" STUB_HEALTH=nope -- "$HERE/deploy.sh"
deploy_case "deploy failure prints rollback command" 1 "mise run deploy -- 0.20.1" STUB_SSH_FAIL="compose pull" STUB_PREV="'0.20.1'" -- "$HERE/deploy.sh"
deploy_case "deploy failure, unknown previous" 1 "mise run deploy -- <previous version>" STUB_SSH_FAIL="compose pull" -- "$HERE/deploy.sh"
deploy_case "deploy, empty db output" 1 "terraform output db_app_password is empty" STUB_EMPTY_OUTPUT=db_app_password -- "$HERE/deploy.sh"
if [ -s "$WORK/ssh.stdin" ] || grep -qE '^(build|push) ' "$WORK/docker.log" || [ -s "$WORK/mise.log" ]; then fail "deploy, empty db output: something was sent, built or tested"; fi
deploy_case "deploy, secret with a quote" 1 "contains a quote" KTOR_ADMIN_PASS="it's" STUB_TAGS_PRESENT=hub/ -- "$HERE/deploy.sh" 0.1.0
[ ! -s "$WORK/ssh.stdin" ] || fail "deploy, quote: .env was written"
deploy_case "deploy refuses latest" 1 "invalid version" STUB_TAGS_PRESENT=hub/ -- "$HERE/deploy.sh" latest

# status
reset_logs
out="$(env PATH="$WORK/bin:$PATH" TF_STATE_BUCKET=b AWS_ACCESS_KEY_ID=k AWS_SECRET_ACCESS_KEY=s EDGE_SSH=u@h STUB_COMPOSE_PS=$'bp_front hub/front:0.21.0\nbp_back hub/back:0.21.0' "$HERE/status.sh" 2>&1 </dev/null)"; rc=$?
if grep -qE "$PRIVATE" "$WORK/ssh.env"; then fail "status: the Spaces key or EDGE_SSH reached ssh"
elif [ $rc -ne 0 ] || [[ $out != *"bp_back hub/back:0.21.0"* ]] || [[ $out != *"https://bag-please.io-workshop.net/ -> HTTP 200"* ]]; then fail "status: rc=$rc output: $out"; else echo "ok   status"; fi
reset_logs
out="$(env PATH="$WORK/bin:$PATH" TF_STATE_BUCKET=b AWS_ACCESS_KEY_ID=k AWS_SECRET_ACCESS_KEY=s EDGE_SSH=u@h STUB_SSH_DEAD=1 STUB_HTTP=502 "$HERE/status.sh" 2>&1 </dev/null)"; rc=$?
if [ $rc -eq 0 ] || [[ $out != *"unreachable"* ]] || [[ $out != *"-> HTTP 502"* ]]; then fail "status, droplet down: rc=$rc output: $out"; else echo "ok   status, droplet unreachable"; fi

# The nested-env derivation covers every name in both examples, TF_VAR_* and KTOR_*.
leaked="$(env -i PATH="$PATH" bash -c '
	. "'"$HERE"'/lib.sh"
	export DIGITALOCEAN_TOKEN=x DOCKER_IMAGE_BACK=x KTOR_JWT_SECRET=x TF_VAR_anything=x KTOR_NEW_ONE=x EDGE_SSH=x
	(unset_deploy; env | grep -E "^(DIGITALOCEAN_TOKEN|DOCKER_IMAGE_BACK|KTOR_|TF_VAR_|EDGE_SSH)" || true)')"
if [ -n "$leaked" ]; then fail "unset_deploy left: $leaked"; else echo "ok   unset_deploy"; fi

# The droplet compose parses and carries the hardening.
if [ -z "$REAL_DOCKER" ] || ! command -v jq >/dev/null || ! "$REAL_DOCKER" compose version >/dev/null 2>&1; then
	fail "droplet compose: needs docker compose and jq installed"
else
	cfg="$(env -i PATH="$PATH" HOME="$HOME" DOCKER_IMAGE_BACK=hub/back DOCKER_IMAGE_FRONT=hub/front BP_VERSION=1.2.3 PRIVATE_IP=10.9.8.7 \
		KTOR_DB_HOST=h KTOR_DB_PORT=1 KTOR_DB_NAME=n KTOR_DB_USER=u KTOR_DB_PASSWORD=p KTOR_JWT_SECRET=s KTOR_ADMIN_LOGIN=l KTOR_ADMIN_PASS=a \
		"$REAL_DOCKER" compose -f "$HERE/../docker-compose.yml" config --format json 2>&1)"
	if jq -e '
		.services.bp_front as $f | .services.bp_back as $b
		| ($f.ports | length == 1 and .[0].host_ip == "10.9.8.7" and (.[0].target|tostring) == "80" and (.[0].published|tostring) == "80")
		and (($b.ports // []) | length == 0)
		and ([$f, $b][] | .read_only == true and (.tmpfs | index("/tmp") != null) and .cap_drop == ["ALL"]
			and (.security_opt | index("no-new-privileges:true") != null) and (.mem_limit != null))
		and ($f.tmpfs | (index("/tmp") != null) and (index("/config") != null) and (index("/data") != null))
		and $f.cap_add == ["NET_BIND_SERVICE"]
		and ($b.environment.JAVA_OPTS | test("-Xmx[0-9]+m"))
		and $b.environment.KTOR_DB_SSLMODE == "verify-full"
		and $b.environment.KTOR_DB_SSLROOTCERT == "/etc/bag-please/ca-certificate.crt"
		and ($b.volumes | map(select(.target == "/etc/bag-please/ca-certificate.crt" and .read_only == true)) | length == 1)
		and ($f.healthcheck.test | join(" ") | test("wget .*http://127.0.0.1/api/health"))
		and ($f.image == "hub/front:1.2.3") and ($b.image == "hub/back:1.2.3")' >/dev/null <<<"$cfg"; then
		echo "ok   droplet compose"
	else fail "droplet compose: hardening keys missing ($cfg)"; fi
fi

if [ "$fails" -ne 0 ]; then echo "$fails case(s) failed" >&2; exit 1; fi
echo "all guard cases passed"
