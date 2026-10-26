# Production infrastructure and releases (Stories 11.9, 11.10)

Terraform declares the app's side of the new home: one DigitalOcean droplet with its firewall, and this app's database
`bag_please` and user `bag_please_app` **on a shared PostgreSQL cluster** (PostgreSQL 18, fra1). The cluster and its
firewall are managed outside this repo; everything this repo needs about them comes from `.secure.deploy.env`
(`TF_VAR_pg_cluster_name`, `TF_VAR_pg_client_tag`, `PG_ADMIN_USER`, `PG_ADMIN_PASSWORD`). This repo only looks the
cluster up by name and must never create it or manage `digitalocean_database_firewall`. Releases (`deploy`, the droplet
compose file) are below.

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
(the backend sets `maxSize=5` on its R2DBC pool; `KTOR_DB_POOL_MAX_SIZE` overrides).

State: Spaces bucket `io-workshop-tfstate`, key `bag-please/web.tfstate`, no locking (never run two applies at once).
`deploy/terraform/.terraform.lock.hcl` is committed. Droplet `user_data` and `image` are in `ignore_changes`: replacing
the droplet is a deliberate `terraform apply -replace=digitalocean_droplet.web` followed by updating the edge upstream
and `ssh-keygen -R <private ip>` (a recreated droplet may reuse an IP already in known_hosts).

## Secrets

Two gitignored files, each with a committed blank `.example`: `.secure.deploy.env` (infrastructure, edge SSH and the
backend's runtime secrets `KTOR_JWT_SECRET`, `KTOR_ADMIN_LOGIN`, `KTOR_ADMIN_PASS`) and `.secure.build.env` (the Docker
Hub image names `DOCKER_IMAGE_BACK`, `DOCKER_IMAGE_FRONT`). `deploy:build` and `deploy:push` load only the build file;
`deploy` loads both; `deploy:status` and the infra/db tasks load only the deploy file. Run `docker login` once on this
machine.

Copy `.secure.deploy.env.example` to `.secure.deploy.env` (gitignored) and fill every variable. Two of them reach
further than this app: the DigitalOcean token can modify or delete the shared cluster (DigitalOcean has no narrower
database scope), and the Spaces key can write the other state objects in the shared bucket. Each mise task loads
that file itself; nothing is global and nothing is exported into your shell. `deploy/scripts/lib.sh` removes every
variable named in either example, and every `TF_VAR_*` and `KTOR_*`, before it runs Gradle, mise, `java` or `psql`; database credentials are read from `terraform output` and set
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
- `mise run deploy:build` - build both images tagged `:<gradle.properties version>` (never `latest`).
- `mise run deploy:push` - refuses a dirty tree, a tag that already exists on Docker Hub for either image (Hub
  overwrites tags silently; checked with `docker manifest inspect`) and a Hub it cannot query; otherwise builds and
  pushes `:<version>` only.
- `mise run deploy [-- <version>]` - the release, see below. `mise run deploy:status` - see below.
- `mise run deploy:test` - guard tests for the refusals and the happy paths (import, bootstrap, push, deploy, status),
  the nested-environment proof, and the droplet compose file's hardening keys, with stubbed
  `terraform`/`ssh`/`git`/`psql`/`gradle`/`java`/`docker`/`mise`/`curl`; no network.

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

## Releasing

Bump `version` in `gradle.properties` and commit (the tree must be clean), then `mise run deploy`:

1. Refuse a dirty tree; refuse if `<version>` is already on Docker Hub (bump it, or `deploy -- <version>` to roll onto
   it); read the database outputs from Terraform state (an empty or null one stops the deploy naming it, before
   anything is tested or pushed).
2. `back:test` (with the secure variables stripped), then build and push `:<version>`.
3. Over `ssh -J <edge> deploy@<droplet>`: write `~deploy/bag-please/.env` (mode 600, via a temp file and `mv` under
   `umask 077`; the content travels as ssh **stdin**, never argv), `ca-certificate.crt` (644) and
   `docker-compose.yml`; `docker compose pull`; `docker compose up -d --wait --remove-orphans` (waits for the
   `bp_front` healthcheck, which reaches `bp_back` through `/api/health`).
4. Smoke test: from the edge, `curl http://<droplet private ip>/api/health` must answer `OK` (a few retries).

If anything after the droplet is first touched fails, the deploy prints the rollback command and stops. It never rolls
back itself. The previous version is read from the old `.env` before it is overwritten; if that was not possible the
hint says `<previous version>`.

`mise run deploy -- <version>` is both "deploy a version I pushed earlier" and the rollback: the tag must already be on
Docker Hub for both images, and nothing is tested, built or pushed. Migrations are additive and backward-compatible
with the previous image, so a rollback needs no database restore.

`mise run deploy:status` prints the images running on the droplet (`docker compose ps`) and the HTTP status of
`https://bag-please.io-workshop.net/`. If the droplet cannot be reached it says so, still prints the HTTP status and
exits 1.

The droplet compose file (`deploy/docker-compose.yml`): `bp_front` is published only on `${PRIVATE_IP}:80`, `bp_back`
not at all; both run `read_only` with `tmpfs` for `/tmp` (and Caddy's `/config`, `/data`), `cap_drop: [ALL]`
(`bp_front` adds `NET_BIND_SERVICE`), `no-new-privileges`, and a `mem_limit` (`bp_back` 512m with `-Xmx256m`,
`bp_front` 64m; the droplet has 1 GB + 1 GB swap). The backend connects with `verify-full` against the CA mounted
read-only at `/etc/bag-please/ca-certificate.crt`; both are fixed in the file.

If the Docker Hub repositories are private, run `docker login` once on the droplet as `deploy`.

## Cutover order (AD-20, Story 11.11)

`infra:apply` (md only), `db:bootstrap`, md takes the Mongo export, `db:import` (backend not yet deployed), md checks
the counts, `deploy`, md verifies both users through the edge jump host, repoint the edge upstream, `deploy:status`,
retire the old deployment. `migration-export/` leaves the working tree once the import is verified. None of this is
done by Story 11.10.

## Live acceptance of Story 11.10 (md; not run by the implementer)

1. Fill `.secure.build.env`, `docker login`, bump the version to a pre-release tag (e.g. `0.22.0-rc1`), commit.
2. `mise run deploy`: tests, build, push, the droplet comes up, the smoke test through the edge passes while the public
   URL still serves the old deployment (`mise run deploy:status` shows the new version on the droplet).
3. Stop the backend again (`ssh -J <edge> deploy@<ip> 'cd bag-please && docker compose stop bp_back'`) and confirm in
   the database that `select count(*) from app_config` is 0 (a smoke deploy leaves no row).
4. Roll back once to prove it: `mise run deploy -- <earlier published version>`.

## Backups

The shared cluster keeps daily backups with 7-day point-in-time recovery for the whole cluster; a restore creates a
new cluster. Managed daily backups are the only automated protection. For this app alone, `pg_dump` is optional before
a release that adds a migration (same `verify-full` public-host connection as `db:import`, as `bag_please_app`):

```bash
PGPASSWORD="$(cd deploy/terraform && terraform output -raw db_app_password)" pg_dump \
  "host=$(cd deploy/terraform && terraform output -raw db_public_host) port=$(cd deploy/terraform && terraform output -raw db_port) dbname=bag_please user=bag_please_app sslmode=verify-full sslrootcert=<ca.pem>" \
  -Fc -f backup-$(date +%Y%m%d-%H%M%S).dump
```

(`*.dump` is gitignored.) Rolling back a release is
`mise run deploy -- <previous version>`; the schema only ever grows backward-compatibly, so no restore is needed.
