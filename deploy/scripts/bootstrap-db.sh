#!/usr/bin/env bash
# bootstrap-db.sh - one-time: make bag_please_app own the bag_please database (as doadmin, the only use of doadmin),
# then run Flyway as bag_please_app by pointing the importer at an empty export directory.
# Needs psql locally. Reaches the database through an SSH tunnel over the droplet; verify-ca (host is 127.0.0.1).
# shellcheck source=lib.sh
. "$(dirname "$0")/lib.sh"
require_env AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY EDGE_SSH
command -v psql >/dev/null || { echo "psql is not installed" >&2; exit 1; }
require_clean_tree
make_scratch
tf_init
load_db_outputs
ADMIN_USER="$(need_out db_admin_user)"
ADMIN_PASSWORD="$(need_out db_admin_password)"
open_tunnel "$DB_HOST" "$DB_PORT"

(
	unset_deploy
	PGPASSWORD="$ADMIN_PASSWORD" psql -v ON_ERROR_STOP=1 \
		"host=127.0.0.1 port=$LOCAL_TUNNEL_PORT dbname=$DB_NAME user=$ADMIN_USER sslmode=verify-ca sslrootcert=$SCRATCH/ca.pem" <<SQL
GRANT "$DB_APP_USER" TO "$ADMIN_USER";
ALTER DATABASE "$DB_NAME" OWNER TO "$DB_APP_USER";
SQL
)

mkdir "$SCRATCH/empty"
run_importer "$SCRATCH/empty"
echo "bootstrap complete: Flyway applied as $DB_APP_USER"
