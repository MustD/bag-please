# Production infrastructure (Story 11.9)

Terraform declares the app's side of the new home: one DigitalOcean droplet with its firewall, and this app's database
`bag_please` and user `bag_please_app` **on the shared PostgreSQL cluster `io-workshop-pg`**. The cluster itself
(PostgreSQL 18, `db-s-1vcpu-1gb`, fra1, daily backups with 7-day point-in-time recovery) and its firewall belong to the
io-workshop hub repo (`postgres/` stack, see its `postgres/README.md`); this repo only looks the cluster up by name and
must never create it or manage `digitalocean_database_firewall`. Deploy tasks (releases, droplet compose) arrive with
Story 11.10.

## What is declared

| Resource | Value | Cost note (2026-10-23 snapshot, re-measure) |
|---|---|---|
| Droplet `bag-please-web` | `s-1vcpu-1gb`, `ubuntu-26-04-x64`, `fra1`, edge's VPC, tag `postgres-client` | about 6 USD/month |
| Droplet firewall | inbound 80 and 22 from `<edge private ip>/32` only | free |
| Cluster `io-workshop-pg` | data source only (hub-owned, shared by all projects) | hub's cost, about 15 USD/month in total |
| Database / user | `bag_please` (`prevent_destroy`) / `bag_please_app`; the app never uses `doadmin` | free |

How the database is reached: the hub's firewall trusts droplets tagged `postgres-client` and the hub owner's current
public IP. The droplet uses the cluster's **private** host (`db_host`); the operator's machine uses the **public** host
(`db_public_host`) directly, so `db:bootstrap` and `db:import` need no SSH tunnel, and both verify the certificate with
`verify-full`. The cluster allows about 22 connections for ALL projects: keep the backend's R2DBC pool at 5 or less
(set in Story 11.10).

State: Spaces bucket `io-workshop-tfstate`, key `bag-please/web.tfstate`, no locking (never run two applies at once).
`deploy/terraform/.terraform.lock.hcl` is committed. Droplet `user_data` and `image` are in `ignore_changes`: replacing
the droplet is a deliberate `terraform apply -replace=digitalocean_droplet.web` followed by updating the edge upstream
and `ssh-keygen -R <private ip>` (a recreated droplet may reuse an IP already in known_hosts).

## Secrets

Copy `.secure.deploy.env.example` to `.secure.deploy.env` (gitignored) and fill every variable. Each mise task loads
that file itself; nothing is global and nothing is exported into your shell. `deploy/scripts/lib.sh` removes every
deploy variable before it runs Gradle, `java` or `psql`; database credentials are read from `terraform output` and set
only as the environment of the one process that needs them (`IMPORT_DB_*` for the importer `java`, `PGPASSWORD` for the
bootstrap `psql`). `doadmin`'s credentials are never stored here: `db:bootstrap` reads them from the hub's Terraform
state (`HUB_DIR`, output `admin_uri`) and is the only task that uses `doadmin`. A blank variable stops the script
naming it.

## Tasks

- `mise run infra:plan` / `infra:apply` - Terraform (`init` runs first). Apply is manual, never from CI.
- `mise run db:bootstrap` - once, after the first apply (safe to repeat before any import): as `doadmin`, the hub's
  recipe for a project database - `GRANT ALL ON SCHEMA public`, `REVOKE CONNECT ... FROM PUBLIC`, `GRANT CONNECT` to
  `bag_please_app` - then Flyway as `bag_please_app` by running the importer on an empty export directory (zero rows).
  Needs `psql` locally, a hub checkout at `HUB_DIR`, and this machine's public IP in the hub's `admin_cidrs`
  (`mise run postgres:apply` in the hub). Do not re-run it after an import: the importer refuses a non-empty database.
- `mise run db:import [-- <export-dir>]` (default `migration-export/`) - the Story 11.8 importer against production.
  Refuses, before any database connection: a missing export directory (exit 2), a dirty git tree, `bp_back` running on
  the droplet. Same IP requirement as above.
- `mise run deploy:test` - guard tests for the refusals, with stubbed `terraform`/`ssh`/`git`; no network.

## Live runbook (md; none of this was run by the implementer)

1. In the hub: `mise run postgres:apply` so this machine's IP is allowed. The cluster must already exist.
2. `mise run infra:plan` - expect the droplet, its firewall, the database and the user to be added, nothing on the
   cluster. `mise run infra:apply`; record the droplet private IP (`terraform output private_ip`) for the edge.
3. `mise run db:bootstrap`.
4. Verify `verify-full` from the droplet (the runtime mode): copy the CA certificate to it
   (`terraform output -raw db_ca_certificate`) and run, there,
   `psql "host=<db_host> port=<db_port> dbname=bag_please user=bag_please_app sslmode=verify-full sslrootcert=ca.pem"`
   (`db_host` is the private hostname; unverified in DigitalOcean's docs that its certificate covers it). If it fails,
   stop: AD-14 goes back to md.
5. Import dry run: `mise run db:import -- <export-dir>` with a fixture export, then empty the database again; check the
   printed export / loaded / dropped counts.

## Backups

The hub's cluster keeps daily backups with 7-day point-in-time recovery for the whole cluster; a restore creates a
new cluster. For this app alone use `pg_dump` (optional before a release that adds a migration).
