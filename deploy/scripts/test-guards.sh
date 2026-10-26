#!/usr/bin/env bash
# Runs each I/O matrix row of Story 11.9 against the real scripts with stubbed terraform/ssh/git/psql/gradle/java on
# PATH, and asserts the refusal, the exit code, and that no database client (psql/java) was started.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir "$WORK/bin" "$WORK/export"
export SSH_LOG="$WORK/ssh.log"

cat >"$WORK/bin/terraform" <<'STUB'
#!/usr/bin/env bash
env >>"$WORK_LOG/terraform.env"
if [ "$1" = output ]; then
	if [ "${3:-}" = "${STUB_EMPTY_OUTPUT:-}" ]; then exit 0; fi
	echo "stub-${3:-x}"
fi
exit 0
STUB
cat >"$WORK/bin/ssh" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$SSH_LOG"
case "$*" in *"docker ps"*) [ -z "${STUB_PS_FAIL:-}" ] || exit 1; printf '%s' "${STUB_RUNNING:-}" ;; esac
exit 0
STUB
cat >"$WORK/bin/git" <<'STUB'
#!/usr/bin/env bash
env >>"$WORK_LOG/git.env"
if [ "$1" = status ]; then printf '%s' "${STUB_DIRTY:-}"; fi
exit 0
STUB
cat >"$WORK/bin/psql" <<'STUB'
#!/usr/bin/env bash
env >"$WORK_LOG/psql.env"
echo "$*" >"$WORK_LOG/psql.args"
cat >"$WORK_LOG/psql.stdin"
echo psql >>"$WORK_LOG/db.log"
STUB
cat >"$WORK/bin/gradle" <<'STUB'
#!/usr/bin/env bash
env >"$WORK_LOG/gradle.env"
echo /stub/classpath
STUB
cat >"$WORK/bin/java" <<'STUB'
#!/usr/bin/env bash
env >"$WORK_LOG/java.env"
echo "$*" >"$WORK_LOG/java.args"
cat "$IMPORT_DB_SSLROOTCERT" >"$WORK_LOG/ca.seen"
for f in "${!#}"/*; do printf '%s %s\n' "${f##*/}" "$(cat "$f")"; done >"$WORK_LOG/export.seen"
echo java >>"$WORK_LOG/db.log"
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
	: >"$SSH_LOG"; : >"$WORK/db.log"
	err="$(env PATH="$WORK/bin:$PATH" AWS_ACCESS_KEY_ID=k AWS_SECRET_ACCESS_KEY=s EDGE_SSH=u@h "${envs[@]}" "$@" 2>&1 >/dev/null)"
	rc=$?
	if [ "$rc" != "$want" ]; then echo "FAIL $name: exit $rc, wanted $want ($err)"; fails=$((fails + 1)); return; fi
	if [[ $err != *"$msg"* ]]; then echo "FAIL $name: stderr lacks '$msg' ($err)"; fails=$((fails + 1)); return; fi
	if [ -s "$WORK/db.log" ]; then echo "FAIL $name: a database client was started"; fails=$((fails + 1)); return; fi
	echo "ok   $name"
}

run_case "missing secret" 1 "DIGITALOCEAN_TOKEN is empty" DIGITALOCEAN_TOKEN= -- "$HERE/infra.sh" plan
run_case "missing export" 2 "export directory not found" -- "$HERE/import.sh" "$WORK/nope"
run_case "dirty tree" 1 "working tree is not clean" STUB_DIRTY=" M file" -- "$HERE/import.sh" "$WORK/export"
run_case "backend running" 1 "bp_back is running" STUB_RUNNING=bp_back -- "$HERE/import.sh" "$WORK/export"

run_case "dirty tree (bootstrap)" 1 "working tree is not clean" STUB_DIRTY=" M file" PG_ADMIN_USER=doadmin PG_ADMIN_PASSWORD=adminpw -- "$HERE/bootstrap-db.sh"
run_case "docker ps fails" 1 "could not check" STUB_PS_FAIL=1 -- "$HERE/import.sh" "$WORK/export"
run_case "empty output" 1 "terraform output db_app_password is empty" STUB_EMPTY_OUTPUT=db_app_password -- "$HERE/import.sh" "$WORK/export"
run_case "missing admin password" 1 "PG_ADMIN_PASSWORD is empty" PG_ADMIN_USER=doadmin -- "$HERE/bootstrap-db.sh"
# A relative export dir means the caller's directory (MISE_ORIGINAL_CWD under mise), not the repo root.
run_case "missing relative export" 2 "export directory not found: $WORK/nope" MISE_ORIGINAL_CWD="$WORK" -- "$HERE/import.sh" nope

# Every variable a script require_env's is in .secure.deploy.env.example, and the example carries no value.
missing=""
# (sed joins backslash-continued require_env lines first.)
for v in $(sed -e ':a' -e '/\\$/{N;s/\\\n//;ba}' "$HERE"/*.sh | sed -n 's/^require_env //p' | tr -s ' \t' '\n' | sort -u); do
	grep -q "^$v=$" "$HERE/../../.secure.deploy.env.example" || missing="$missing $v"
done
if [ -n "$missing" ]; then echo "FAIL env example: missing or filled in:$missing"; fails=$((fails + 1))
elif grep -qE '^[A-Z_]+=.+' "$HERE/../../.secure.deploy.env.example"; then echo "FAIL env example: a variable has a value"; fails=$((fails + 1))
else echo "ok   env example"; fi

LEAK='^(DIGITALOCEAN_TOKEN|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|EDGE_SSH|PG_ADMIN_USER|PG_ADMIN_PASSWORD|TF_VAR_[A-Za-z_]*)='
ADMIN='^(PG_ADMIN_USER|PG_ADMIN_PASSWORD)='

# infra: terraform gets the token and TF_VAR_*, never the cluster admin's credentials.
: >"$WORK/terraform.env"
if ! env PATH="$WORK/bin:$PATH" AWS_ACCESS_KEY_ID=k AWS_SECRET_ACCESS_KEY=s DIGITALOCEAN_TOKEN=t TF_VAR_edge_private_ip=1.2.3.4 \
	TF_VAR_vpc_name=v TF_VAR_ssh_key_name=k TF_VAR_pg_cluster_name=c TF_VAR_pg_client_tag=t \
	PG_ADMIN_USER=doadmin PG_ADMIN_PASSWORD=adminpw "$HERE/infra.sh" plan >/dev/null 2>&1; then
	echo "FAIL infra: infra.sh plan exited non-zero"; fails=$((fails + 1))
elif ! grep -q '^DIGITALOCEAN_TOKEN=t$' "$WORK/terraform.env" || grep -qE "$ADMIN" "$WORK/terraform.env"; then
	echo "FAIL infra: terraform lacks the token or saw the cluster admin's credentials"; fails=$((fails + 1))
else
	echo "ok   infra"
fi

# Happy path: java gets IMPORT_DB_* (verify-full, the public host, the cluster CA) and the relative export dir resolved
# against MISE_ORIGINAL_CWD, no deploy variable reaches gradle or java, and terraform output never sees the
# DigitalOcean token or the cluster admin's credentials.
: >"$SSH_LOG"; : >"$WORK/db.log"; : >"$WORK/terraform.env"
if ! env PATH="$WORK/bin:$PATH" AWS_ACCESS_KEY_ID=k AWS_SECRET_ACCESS_KEY=s EDGE_SSH=u@h DIGITALOCEAN_TOKEN=t \
	TF_VAR_vpc_name=v TF_VAR_edge_private_ip=1.2.3.4 PG_ADMIN_USER=doadmin PG_ADMIN_PASSWORD=adminpw MISE_ORIGINAL_CWD="$WORK" \
	"$HERE/import.sh" export >/dev/null 2>&1; then
	echo "FAIL happy path: import.sh exited non-zero"; fails=$((fails + 1))
elif ! grep -q '^IMPORT_DB_SSLMODE=verify-full$' "$WORK/java.env" || ! grep -q '^IMPORT_DB_HOST=stub-db_public_host$' "$WORK/java.env" || ! grep -q '^IMPORT_DB_PASSWORD=stub-db_app_password$' "$WORK/java.env"; then
	echo "FAIL happy path: java lacks IMPORT_DB_*"; fails=$((fails + 1))
elif [ "$(cat "$WORK/ca.seen")" != stub-db_ca_certificate ]; then
	echo "FAIL happy path: IMPORT_DB_SSLROOTCERT does not hold db_ca_certificate"; fails=$((fails + 1))
elif grep -qE "$LEAK" "$WORK/gradle.env" "$WORK/java.env"; then
	echo "FAIL happy path: a deploy variable leaked into gradle or java"; fails=$((fails + 1))
elif [ "$(awk '{print $NF}' "$WORK/java.args")" != "$WORK/export" ]; then
	echo "FAIL happy path: importer got $(awk '{print $NF}' "$WORK/java.args"), not $WORK/export"; fails=$((fails + 1))
elif grep -qE "^DIGITALOCEAN_TOKEN=|$ADMIN" "$WORK/terraform.env"; then
	echo "FAIL happy path: terraform output saw DIGITALOCEAN_TOKEN or the cluster admin's credentials"; fails=$((fails + 1))
else
	echo "ok   happy path"
fi

# Bootstrap happy path: psql connects as the cluster admin to bag_please (verify-full), with PGPASSWORD alone, runs the
# grants for the app user; then java runs Flyway on an export of empty collections. No deploy variable reaches either.
: >"$SSH_LOG"; : >"$WORK/db.log"; : >"$WORK/terraform.env"; : >"$WORK/git.env"; rm -f "$WORK/psql."* "$WORK/java.env" "$WORK/export.seen"
if ! env PATH="$WORK/bin:$PATH" AWS_ACCESS_KEY_ID=k AWS_SECRET_ACCESS_KEY=s DIGITALOCEAN_TOKEN=t TF_VAR_vpc_name=v \
	PG_ADMIN_USER=doadmin PG_ADMIN_PASSWORD=adminpw "$HERE/bootstrap-db.sh" >/dev/null 2>&1; then
	echo "FAIL bootstrap happy path: bootstrap-db.sh exited non-zero"; fails=$((fails + 1))
elif ! grep -q 'dbname=stub-db_name user=doadmin sslmode=verify-full sslrootcert=' "$WORK/psql.args" \
	|| ! grep -q 'host=stub-db_public_host' "$WORK/psql.args" || ! grep -q 'connect_timeout=10' "$WORK/psql.args"; then
	echo "FAIL bootstrap happy path: psql connection string ($(cat "$WORK/psql.args"))"; fails=$((fails + 1))
elif ! grep -q '^PGPASSWORD=adminpw$' "$WORK/psql.env"; then
	echo "FAIL bootstrap happy path: psql lacks PGPASSWORD"; fails=$((fails + 1))
elif ! grep -q 'GRANT ALL ON SCHEMA public TO "stub-db_app_user"' "$WORK/psql.stdin" \
	|| ! grep -q 'REVOKE CONNECT ON DATABASE "stub-db_name" FROM PUBLIC' "$WORK/psql.stdin" \
	|| ! grep -q 'GRANT CONNECT ON DATABASE "stub-db_name" TO "stub-db_app_user"' "$WORK/psql.stdin"; then
	echo "FAIL bootstrap happy path: grants missing from psql input"; fails=$((fails + 1))
elif grep -qE "$LEAK" "$WORK/psql.env" "$WORK/gradle.env" "$WORK/java.env"; then
	echo "FAIL bootstrap happy path: a deploy variable leaked into psql, gradle or java"; fails=$((fails + 1))
elif grep -q '^PGPASSWORD=' "$WORK/java.env"; then
	echo "FAIL bootstrap happy path: PGPASSWORD reached java"; fails=$((fails + 1))
elif grep -qE "$ADMIN" "$WORK/terraform.env" "$WORK/git.env"; then
	echo "FAIL bootstrap happy path: terraform or git saw the cluster admin's credentials"; fails=$((fails + 1))
# The names are checked against the importer by MongoImportTest ("db:bootstrap's all-empty export ..."); here, that
# every seeded file holds an empty array.
elif [ "$(wc -l <"$WORK/export.seen")" -ne 7 ] || grep -qv ' \[\]$' "$WORK/export.seen" || [ -s "$SSH_LOG" ]; then
	echo "FAIL bootstrap happy path: export dir not seeded with 7 empty collections, or ssh was used"; fails=$((fails + 1))
else
	echo "ok   bootstrap happy path"
fi

if [ "$fails" -ne 0 ]; then echo "$fails case(s) failed" >&2; exit 1; fi
echo "all guard cases passed"
