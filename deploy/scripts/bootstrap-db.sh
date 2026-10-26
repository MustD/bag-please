#!/usr/bin/env bash
# bootstrap-db.sh - one-time, idempotent: the shared cluster's recipe for a project database (as the cluster admin, the
# only use of it), then Flyway as bag_please_app by pointing the importer at an export whose collections are all empty
# (the importer reads every required file before it migrates, so a bare empty directory fails). The admin's credentials
# come from .secure.deploy.env (PG_ADMIN_USER, PG_ADMIN_PASSWORD). Needs psql locally and this machine's public IP among
# the cluster's trusted sources. Connects to the cluster's public host with verify-full.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
require_env AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY PG_ADMIN_USER PG_ADMIN_PASSWORD
load_admin
command -v psql >/dev/null || { echo "psql is not installed" >&2; exit 1; }
require_clean_tree
make_scratch
tf_init
load_db_outputs

(
	unset_deploy
	PGPASSWORD="$ADMIN_PASSWORD" psql -v ON_ERROR_STOP=1 \
		"host=$DB_PUBLIC_HOST port=$DB_PORT dbname=$DB_NAME user=$ADMIN_USER sslmode=verify-full sslrootcert=$SCRATCH/ca.pem connect_timeout=10" <<SQL
GRANT ALL ON SCHEMA public TO "$DB_APP_USER";
REVOKE CONNECT ON DATABASE "$DB_NAME" FROM PUBLIC;
GRANT CONNECT ON DATABASE "$DB_NAME" TO "$DB_APP_USER";
SQL
)

mkdir "$SCRATCH/empty"
for c in users lists list_members categories items feedback app_config; do echo '[]' >"$SCRATCH/empty/$c.json"; done
run_importer "$SCRATCH/empty"
echo "bootstrap complete: Flyway applied as $DB_APP_USER"
