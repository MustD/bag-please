#!/usr/bin/env bash
# Runs each I/O matrix row of Story 11.9 against the real scripts with stubbed terraform/ssh/git/psql/gradle/java on
# PATH, and asserts the refusal, the exit code, and that no tunnel (`ssh ... -L`) was started.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir "$WORK/bin" "$WORK/export"
export SSH_LOG="$WORK/ssh.log"

cat >"$WORK/bin/terraform" <<'STUB'
#!/usr/bin/env bash
if [ "$1" = output ]; then echo "stub-${3:-x}"; fi
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
if [ "$1" = status ]; then printf '%s' "${STUB_DIRTY:-}"; fi
exit 0
STUB
printf '#!/usr/bin/env bash\necho "UNEXPECTED psql" >&2\nexit 0\n' >"$WORK/bin/psql"
cat >"$WORK/bin/gradle" <<'STUB'
#!/usr/bin/env bash
env >"$WORK_LOG/gradle.env"
echo /stub/classpath
STUB
cat >"$WORK/bin/java" <<'STUB'
#!/usr/bin/env bash
env >"$WORK_LOG/java.env"
echo "$*" >"$WORK_LOG/java.args"
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
	err="$(env PATH="$WORK/bin:$PATH" AWS_ACCESS_KEY_ID=k AWS_SECRET_ACCESS_KEY=s EDGE_SSH=u@h "${envs[@]}" "$@" 2>&1 >/dev/null)"
	rc=$?
	if [ "$rc" != "$want" ]; then echo "FAIL $name: exit $rc, wanted $want ($err)"; fails=$((fails + 1)); return; fi
	if [[ $err != *"$msg"* ]]; then echo "FAIL $name: stderr lacks '$msg' ($err)"; fails=$((fails + 1)); return; fi
	if grep -q -e ' -L ' -e ' -L' "$SSH_LOG"; then echo "FAIL $name: a tunnel was started"; fails=$((fails + 1)); return; fi
	echo "ok   $name"
}

run_case "missing secret" 1 "DIGITALOCEAN_TOKEN is empty" DIGITALOCEAN_TOKEN= -- "$HERE/infra.sh" plan
run_case "missing export" 2 "export directory not found" -- "$HERE/import.sh" "$WORK/nope"
run_case "dirty tree" 1 "working tree is not clean" STUB_DIRTY=" M file" -- "$HERE/import.sh" "$WORK/export"
run_case "backend running" 1 "bp_back is running" STUB_RUNNING=bp_back -- "$HERE/import.sh" "$WORK/export"

run_case "dirty tree (bootstrap)" 1 "working tree is not clean" STUB_DIRTY=" M file" -- "$HERE/bootstrap-db.sh"
run_case "docker ps fails" 1 "could not check" STUB_PS_FAIL=1 -- "$HERE/import.sh" "$WORK/export"

# Happy path: a tunnel is opened, java gets IMPORT_DB_* (verify-ca), no deploy variable reaches gradle or java.
: >"$SSH_LOG"
if ! env PATH="$WORK/bin:$PATH" AWS_ACCESS_KEY_ID=k AWS_SECRET_ACCESS_KEY=s EDGE_SSH=u@h DIGITALOCEAN_TOKEN=t \
	TF_VAR_vpc_name=v TF_VAR_edge_private_ip=1.2.3.4 "$HERE/import.sh" "$WORK/export" >/dev/null 2>&1; then
	echo "FAIL happy path: import.sh exited non-zero"; fails=$((fails + 1))
elif ! grep -q ' -L ' "$SSH_LOG"; then
	echo "FAIL happy path: no tunnel opened"; fails=$((fails + 1))
elif ! grep -q '^IMPORT_DB_SSLMODE=verify-ca$' "$WORK/java.env" || ! grep -q '^IMPORT_DB_PASSWORD=stub-db_app_password$' "$WORK/java.env" \
	|| ! grep -q '^IMPORT_DB_HOST=127.0.0.1$' "$WORK/java.env"; then
	echo "FAIL happy path: java lacks IMPORT_DB_*"; fails=$((fails + 1))
elif grep -qE '^(DIGITALOCEAN_TOKEN|AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|EDGE_SSH|TF_VAR_[A-Za-z_]*)=' "$WORK/gradle.env" "$WORK/java.env"; then
	echo "FAIL happy path: a deploy variable leaked into gradle or java"; fails=$((fails + 1))
else
	echo "ok   happy path"
fi

if [ "$fails" -ne 0 ]; then echo "$fails case(s) failed" >&2; exit 1; fi
echo "all guard cases passed"
