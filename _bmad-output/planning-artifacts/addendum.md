---
title: bag-please PRD addendum
updated: 2026-10-22
---

# PRD Addendum

Depth that downstream documents (architecture, epics) need but that does not belong in `prd.md`.

## Epic 11 — PostgreSQL and a DigitalOcean deployment

Inputs: md, 2026-10-21; reference implementation `/home/md/projects/personal/mal_ui` (md's own project, same edge).

### Technical choices stated by md

- **Data access:** JetBrains Exposed on PostgreSQL. Whether to use the DSL or DAO style, which connection pool, and
  which migration tool backs FR72 (Flyway, Exposed's `MigrationUtils`, or something else) are for architecture.
- **Database:** a DigitalOcean Managed PostgreSQL cluster, separate from the droplet, on the cheapest tier (currently a
  single-node, 1 vCPU / 1 GB plan; check the slug and price when applying). Trusted sources are limited to the droplet.
- **Infrastructure as code:** Terraform with the `digitalocean` provider.
- **Deploy:** operator-run mise tasks, as in mal_ui. No CI deploy.

### What mal_ui does that maps over

- `deploy/terraform/` holds `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf`, `cloud-init.yaml.tftpl`, and a
  committed `.terraform.lock.hcl`. Its own `.gitignore` covers `.terraform/`, `*.tfstate`, `*.tfstate.*`, `crash.log`
  and `*.tfvars`.
- The VPC and SSH key are looked up as data sources, not created: DigitalOcean refuses a duplicate key, and the VPC
  belongs to the edge.
- `lifecycle { ignore_changes = [user_data, image] }` on the droplet, so a cloud-init edit never silently replaces
  it and moves the edge's upstream IP.
- The firewall allows inbound 80 and 22 only from the edge's private IP. SSH goes through the edge as a jump host
  (`ssh -J $EDGE_SSH deploy@<private ip>`).
- Remote state goes in an S3 backend on DigitalOcean Spaces (the `io-workshop-tfstate` bucket from the
  io-workshop-hub stack), using a Spaces key.
- Secrets are kept in `.secure.deploy.env` and `.secure.build.env`. Both are gitignored as `.secure.*.env`, and each
  has a committed `.example` copy. mise loads them only for the infra and deploy tasks, and `lib.sh` keeps deploy
  secrets out of Gradle's environment.
- `deploy/scripts/` holds `infra.sh` (plan/apply, by hand), `deploy.sh`, `push.sh`, `smoke.sh` and `status.sh`.
- `deploy/docker-compose.yml` runs on the droplet with a `.env` that the deploy writes. Containers are hardened:
  `read_only`, `cap_drop: [ALL]`, `no-new-privileges` and `mem_limit`. Only the web container is published, and only
  on the private IP.

### Points for architecture to settle

- The format of the Mongo export (`mongoexport` per collection as JSON lines, or `mongodump` followed by `bsondump`),
  and how ObjectIds, dates and nested arrays (an item's stores, a list's members) map to rows.
- Where the import script lives (a Gradle task or a separate main in `bp_back`, or a standalone script) and how it
  reaches the managed database (through the droplet, or by temporarily adding the operator's IP as a trusted source).
- The refresh token purge for NFR2: a scheduled delete, or a check at read time plus a periodic sweep.
- Where the JWT secret and admin credentials are delivered on the droplet: the deploy-written `.env`, mode 600, owned
  by the deploy user.
- NFR-D1 deliberately has no automated secret scan (md, 2026-10-21): gitignore patterns plus committed blank
  `.example` files are the control, so the patterns must cover every secret-bearing path before the first secret exists.
- Retiring the Mongo-era pieces: `Migration.kt` and the `app_migrations` gate, every `mongo/` storage package, the
  `mongo` service and the `db_data` volume in `docker-compose.yaml`, and CLAUDE.md's mongodump/restore section, which
  `pg_dump` and the managed backups replace.
- The E2E stack (NFR17) runs PostgreSQL in Compose.

Settled 2026-10-22 in `architecture/architecture-epic-11/ARCHITECTURE-SPINE.md`: export format and mapping (AD-9,
AD-18), importer location and reach (AD-9, SSH tunnel from the operator's machine), refresh-token purge (AD-10),
droplet secret delivery (AD-12), gitignore coverage (AD-12), Mongo-era retirement (AD-5, AD-16, AD-19), E2E on
PostgreSQL (AD-16).
