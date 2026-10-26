# Production infrastructure (Story 11.9)

Terraform declares the app's side of the new home: one DigitalOcean droplet with its firewall, and this app's database
`bag_please` and user `bag_please_app` **on a shared PostgreSQL cluster** (PostgreSQL 18, fra1). The cluster and its
firewall are managed outside this repo; everything this repo needs about them comes from `.secure.deploy.env`
(`TF_VAR_pg_cluster_name`, `TF_VAR_pg_client_tag`, `PG_ADMIN_USER`, `PG_ADMIN_PASSWORD`). This repo only looks the
cluster up by name and must never create it or manage `digitalocean_database_firewall`. Deploy tasks (releases,
droplet compose) arrive with Story 11.10.

## What is declared

| Resource                         | Value                                                             | Cost note (2026-10-23 snapshot) |
|----------------------------------|-------------------------------------------------------------------|---------------------------------|
| Droplet `bag-please-web`         | `s-1vcpu-1gb`, `ubuntu-26-04-x64`, `fra1`, edge's VPC, client tag | about 6 USD/month               |
| Droplet firewall                 | inbound 80 and 22 from `<edge private ip>/32` only                | free                            |
| Cluster `TF_VAR_pg_cluster_name` | data source only (managed elsewhere, shared)                      | not billed here                 |
| Database / user                  | `bag_please` / `bag_please_app` (both `prevent_destroy`)          | free                            |

How the database is reached: the cluster's firewall trusts droplets carrying the client tag (every project's that
shares the cluster, not only this one), plus whatever other sources its owner allows, such as the operator's public IP.
What keeps other projects out of `bag_please` is therefore `bag_please_app`'s password plus
`REVOKE CONNECT ... FROM PUBLIC`, not the network. The app never uses the cluster admin (`doadmin`). The droplet uses
the cluster's **private** host (`db_host`); the operator's machine uses the **public** host (`db_public_host`)
directly, so `db:bootstrap` and `db:import` need no SSH tunnel, and both verify the certificate with `verify-full`. The
smallest DigitalOcean cluster allows about 22 connections for ALL projects: keep the backend's R2DBC pool at 5 or less
(set in Story 11.10).

State: Spaces bucket `io-workshop-tfstate`, key `bag-please/web.tfstate`, no locking (never run two applies at once).
`deploy/terraform/.terraform.lock.hcl` is committed. Droplet `user_data` and `image` are in `ignore_changes`: replacing
the droplet is a deliberate `terraform apply -replace=digitalocean_droplet.web` followed by updating the edge upstream
and `ssh-keygen -R <private ip>` (a recreated droplet may reuse an IP already in known_hosts).

## Secrets

Copy `.secure.deploy.env.example` to `.secure.deploy.env` (gitignored) and fill every variable. Two of them reach
further than this app: the DigitalOcean token can modify or delete the shared cluster (DigitalOcean has no narrower
database scope), and the Spaces key can write the other state objects in the shared bucket. Each mise task loads
that file itself; nothing is global and nothing is exported into your shell. `deploy/scripts/lib.sh` removes every
deploy variable before it runs Gradle, `java` or `psql`; database credentials are read from `terraform output` and set
only as the environment of the one process that needs them (`IMPORT_DB_*` for the importer `java`, `PGPASSWORD` for the
bootstrap `psql`). The cluster admin's credentials (`PG_ADMIN_USER`, `PG_ADMIN_PASSWORD`, DigitalOcean's `doadmin`)
are required by `db:bootstrap` alone. mise loads them into every task with the rest of the file, so each script drops
them before it runs anything (Terraform, git, Gradle), and only the bootstrap `psql` gets the password, as
`PGPASSWORD`. They can be blanked again after the bootstrap. A blank variable stops the script naming it.

## Tasks

- `mise run infra:plan` / `infra:apply` - Terraform (`init` runs first). Apply is manual, never from CI.
- `mise run db:bootstrap` - once, after the first apply (safe to repeat before any import): as the cluster admin, the
  recipe for a project database on a shared cluster - `GRANT ALL ON SCHEMA public`, `REVOKE CONNECT ... FROM PUBLIC`,
  `GRANT CONNECT` to `bag_please_app` - then Flyway as `bag_please_app` by running the importer on an export whose
  collections are all `[]` (zero rows). Needs `psql` locally and this machine's public IP among the cluster's trusted
  sources. Do not re-run it after an import: the importer refuses a non-empty database.
- `mise run db:import [-- <export-dir>]` (default: the repo root's `migration-export/`; a relative `<export-dir>` is
  the directory you ran mise from) - the Story 11.8 importer against production.
  Refuses, before any database connection: a missing export directory (exit 2), a dirty git tree, `bp_back` running on
  the droplet. Same database IP requirement as above, and it checks the droplet over SSH through the edge, so this
  machine's IP must also be allowed on the edge's port 22.
- `mise run deploy:test` - guard tests for the refusals and both happy paths (import, bootstrap), with stubbed
  `terraform`/`ssh`/`git`/`psql`/`gradle`/`java`; no network.

## Live runbook (md; none of this was run by the implementer)

1. Make sure this machine's current public IP is allowed by the cluster's firewall (database access) and on the
   edge's port 22 (used by `db:import`); both are managed outside this repo. The cluster must already exist. Fill
   `.secure.deploy.env`, including the cluster name, client tag and admin credentials. `mise install` provides
   Terraform 1.15.
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

The shared cluster keeps daily backups with 7-day point-in-time recovery for the whole cluster; a restore creates a
new cluster. For this app alone use `pg_dump` (optional before a release that adds a migration).
