# Production infrastructure (Story 11.9)

Terraform declares the new home: one DigitalOcean droplet, its firewall, a managed PostgreSQL 18 cluster whose
firewall trusts only that droplet, the `bag_please` database and the `bag_please_app` user. Layout and conventions
mirror `mal_ui/deploy`. Deploy tasks (releases, droplet compose) arrive with Story 11.10.

## What is declared

| Resource | Value | Cost note (2026-10-23 snapshot, re-measure) |
|---|---|---|
| Droplet `bag-please-web` | `s-1vcpu-1gb`, `ubuntu-26-04-x64`, `fra1`, in the edge's VPC | about 6 USD/month |
| Droplet firewall | inbound 80 and 22 from `<edge private ip>/32` only | free |
| Cluster `bag-please-pg` | PostgreSQL 18, 1 node, slug `db-s-1vcpu-1gb`, same VPC | about 15 USD/month |
| Database firewall | exactly one rule: `droplet` = the web droplet | free |
| Database / user | `bag_please` / `bag_please_app` (the app never uses `doadmin`) | free |

State: Spaces bucket `io-workshop-tfstate`, key `bag-please/web.tfstate`, no locking (never run two applies at once).
`deploy/terraform/.terraform.lock.hcl` is committed. Droplet `user_data` and `image` are in `ignore_changes`: replacing
the droplet is a deliberate `terraform apply -replace=digitalocean_droplet.web` followed by updating the edge upstream and `ssh-keygen -R <private ip>` (a recreated droplet may reuse an IP that is
already in known_hosts with the old host key).

## Secrets

Copy `.secure.deploy.env.example` to `.secure.deploy.env` (gitignored) and fill every variable. Each mise task loads
that file itself; nothing is global and nothing is exported into your shell. `deploy/scripts/lib.sh` removes every
deploy variable before it runs Gradle, `java` or `psql`; database credentials are read from `terraform output` and
set only as the environment of the one process that needs them (`IMPORT_DB_*` for the importer `java`, `PGPASSWORD`
for the bootstrap `psql`). `doadmin` is used by `db:bootstrap` only. A blank variable stops the script naming it.

## Tasks

- `mise run infra:plan` / `infra:apply` - Terraform (`init` runs first). Apply is manual, never from CI.
- `mise run db:bootstrap` - once, after the first apply: through an SSH tunnel (edge jump host, droplet, cluster
  private host, local port 25433) it makes `bag_please_app` owner of `bag_please` (as `doadmin`), then runs Flyway as
  `bag_please_app` by running the importer on an empty export directory (zero rows loaded). Needs `psql` locally. Do not
  re-run `db:bootstrap` after an import: the importer refuses a non-empty database.
- `mise run db:import [-- <export-dir>]` (default `migration-export/`) - the Story 11.8 importer against production.
  Refuses, before any tunnel: a missing export directory (exit 2), a dirty git tree, `bp_back` running on the droplet.
  The importer uses `verify-ca` with the cluster CA (the tunnel host is `127.0.0.1`, so `verify-full` cannot match).
- `mise run deploy:test` - guard tests for the above refusals, with stubbed `terraform`/`ssh`/`git`; no network.

## Live runbook (md; none of this was run by the implementer)

1. `mise run infra:plan` - expect droplet, firewall, cluster, db, user, database firewall to be added.
2. `mise run infra:apply`. Record the droplet private IP (`terraform output private_ip`) for the edge.
3. `mise run db:bootstrap`. Unverified assumption: `doadmin` may `GRANT bag_please_app TO doadmin` and
   `ALTER DATABASE ... OWNER TO bag_please_app`; if DigitalOcean refuses, adjust the SQL in `bootstrap-db.sh`.
4. Verify `verify-full` from the droplet (the runtime mode): copy the CA certificate to the droplet
   (`terraform output -raw db_ca_certificate`) and run, there,
   `psql "host=<db_host> port=<db_port> dbname=bag_please user=bag_please_app sslmode=verify-full sslrootcert=ca.pem"`
   (`db_host` is the private hostname the certificate covers).
5. Import dry run: `mise run db:import -- <export-dir>` with the droplet's backend stopped (not yet deployed). Check
   the printed export / loaded / dropped counts.
