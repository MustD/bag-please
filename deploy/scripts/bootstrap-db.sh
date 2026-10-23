#!/usr/bin/env bash
# bootstrap-db.sh - one-time, idempotent: the io-workshop hub's recipe for a project database on the shared cluster
# (as doadmin, the only use of doadmin), then Flyway as bag_please_app by pointing the importer at an empty export
# directory. doadmin's credentials come from the hub's Terraform state (HUB_DIR). Needs psql locally and this
# machine's public IP in the hub's admin_cidrs (hub: mise run postgres:apply). Connects to the cluster's public host
# with verify-full.
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
require_env AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY EDGE_SSH HUB_DIR
command -v psql >/dev/null || { echo "psql is not installed" >&2; exit 1; }
require_clean_tree
make_scratch
tf_init
load_db_outputs
load_admin

(
	unset_deploy
	PGPASSWORD="$ADMIN_PASSWORD" psql -v ON_ERROR_STOP=1 \
		"host=$DB_PUBLIC_HOST port=$DB_PORT dbname=$DB_NAME user=$ADMIN_USER sslmode=verify-full sslrootcert=$SCRATCH/ca.pem" <<SQL
GRANT ALL ON SCHEMA public TO "$DB_APP_USER";
REVOKE CONNECT ON DATABASE "$DB_NAME" FROM PUBLIC;
GRANT CONNECT ON DATABASE "$DB_NAME" TO "$DB_APP_USER";
SQL
)

mkdir "$SCRATCH/empty"
run_importer "$SCRATCH/empty"
echo "bootstrap complete: Flyway applied as $DB_APP_USER"
