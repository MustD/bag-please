---
title: 'The new home exists in Terraform (Story 11.9)'
type: 'feature'
created: '2026-10-23'
status: 'review'
baseline_revision: '6b776a8a14dcc729debe1a95203d7e250d88d984'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-11-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-11-8-production-data-can-be-imported-in-one-go.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Production has no declared home: no droplet, no database on the managed PostgreSQL, and no way for md to bootstrap the database or run the import against it without leaking a secret.

**Approach:** `deploy/terraform/` (mal_ui layout) declares the droplet, its firewall, database `bag_please` and user `bag_please_app` on a shared PostgreSQL cluster managed outside this repo (a data source named by `TF_VAR_pg_cluster_name`; the droplet carries the client tag `TF_VAR_pg_client_tag`); `deploy/scripts/` and the mise tasks `infra:plan`, `infra:apply`, `db:bootstrap`, `db:import` drive it with secrets loaded per task from a gitignored `.secure.deploy.env` (committed blank `.example`).

## Boundaries & Constraints

**Always:** Terraform `~> 1.15`, provider `digitalocean ~> 2.106`; VPC and SSH key are data sources; droplet `ignore_changes = [user_data, image]`; firewall inbound only 80 and 22 from `${edge_private_ip}/32`; S3 backend bucket `io-workshop-tfstate`, key `bag-please/web.tfstate`; `.terraform.lock.hcl` committed, own `.gitignore`. The cluster is managed outside this repo and only looked up; no cluster and no `digitalocean_database_firewall` here; nothing reads another repo — every value about the cluster comes from `.secure.deploy.env`. Secrets reach only the process that needs them: tasks load `.secure.deploy.env` themselves, `lib.sh` strips every deploy variable before any nested Gradle/mise task, nothing exported into the operator's shell, DB credentials read from `terraform output` and passed only as the `IMPORT_DB_*` env of the `java` command (importer uses `verify-full` against the public host, no tunnel). `doadmin` (`PG_ADMIN_USER`/`PG_ADMIN_PASSWORD`) is used by `db:bootstrap` only. `db:import` refuses a dirty tree and refuses while `bp_back` runs on the droplet. Docs move with behaviour: new `deploy/README.md`, root `CLAUDE.md`, Zed tasks re-synced.

**Never:** No `terraform apply` or any DigitalOcean call without md; no secret, state or tfvars committed; no deploy tasks, droplet compose, `deploy:*` or `.secure.build.env` (Story 11.10); no runtime change to `bp_back`; the importer is not edited.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Missing secret | `.secure.deploy.env` blank | script stops naming the variable | exit 1 |
| Dirty tree | uncommitted change | `db:import` and `db:bootstrap` refuse before any database connection | exit 1 |
| Backend running | `bp_back` container up on droplet | `db:import` refuses | exit 1 |
| Missing export | no export dir | `db:import` refuses before any database connection | exit 2 |

</intent-contract>

## Code Map

- `/home/md/projects/personal/mal_ui/deploy/terraform/*`, `deploy/scripts/{lib,infra}.sh`, `mise.toml` infra tasks -- reference layout to mirror (state key and names changed to bag-please).
- `mise/db_import.sh`, `bp_back/src/import/.../MongoImport.kt` -- importer takes `IMPORT_DB_*` env + export dir; it reads every required `<collection>.json` BEFORE Flyway, so `db:bootstrap` gives it a dir of `[]` files, which loads zero rows after Flyway and is how Flyway runs as `bag_please_app`.
- `mise.toml`, `.zed/tasks.json` -- new tasks; `mise run zed:sync`.
- `.gitignore` -- already covers `.secure.*.env`, `*.tfstate*`, `*.tfvars`, `.terraform/`; `.terraform.lock.hcl` must not be ignored.
- `CLAUDE.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml` -- docs and 11-9 status.

## Tasks & Acceptance

**Execution:**
- `deploy/terraform/{versions,main,variables,outputs}.tf`, `cloud-init.yaml.tftpl`, `.gitignore` -- droplet (with the client tag), firewall, shared-cluster data source, db, user, CA data source; outputs incl. sensitive DB credentials -- AD-11
- `deploy/terraform/.terraform.lock.hcl` -- `terraform init -backend=false`, committed -- AR-E11-19
- `.secure.deploy.env.example` -- every variable the tasks read, blank, one comment each -- AD-12
- `deploy/scripts/{lib,infra,bootstrap-db,import}.sh` -- guards, `verify-full` on the cluster's public host, doadmin from `.secure.deploy.env`, credentials as env of one process -- AD-9
- `mise.toml`, `.zed/tasks.json` -- `infra:plan`, `infra:apply`, `db:bootstrap`, `db:import` loading only `.secure.deploy.env`
- `deploy/scripts/test-guards.sh` -- runs each I/O matrix row against the scripts with stubbed `terraform`/`ssh`/`git` on PATH and asserts the refusal and that no database client was started, plus the import and bootstrap happy paths; wired as mise task `deploy:test` -- matrix coverage
- `deploy/README.md`, `CLAUDE.md` -- runbook with droplet size/price, the IP prerequisites and the verify-full check
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- 11-9 status

**Acceptance Criteria:**
- Given `deploy/terraform/`, when `terraform init -backend=false && terraform validate && terraform fmt -check` run, then all pass; the lock file is tracked and `git check-ignore` does not match it.
- Given the committed files, when `git grep` for token/password values runs, then none; `.secure.deploy.env.example` lists every variable the scripts `require_env`, all blank.
- Given scripts, when `shellcheck`/`bash -n` run and the guard cases of the matrix are run, then they refuse as specified without starting a database client.
- Given a real DigitalOcean account (md), when `infra:plan` runs, then the plan shows the resources above; the live steps (apply, bootstrap, `verify-full` psql from the droplet, import dry run) are documented in `deploy/README.md` and reported as not run here.

### Review Findings

Review pass 3 (2026-10-26, 2026-10-25 "no hub link" rework, uncommitted diff vs `d30b1ca`).

- [x] [Review][Patch] Planning docs still state the hub's cluster, tag and `admin_cidrs` as the design; md (2026-10-26): make them owner-neutral, like the README [_bmad-output/planning-artifacts/epics.md:276, _bmad-output/planning-artifacts/architecture/architecture-epic-11/ARCHITECTURE-SPINE.md:210]
- [x] [Review][Patch] Cluster admin password reaches terraform, git and ssh, not only the bootstrap psql: `tf()` unsets only `DIGITALOCEAN_TOKEN` and `infra.sh` execs terraform with the whole `.secure.deploy.env`; the test checks only the token [deploy/scripts/lib.sh:31, deploy/scripts/infra.sh:11]
- [x] [Review][Patch] Bootstrap's seeded collection list is checked by count only, and no test runs the real importer on an all-`[]` export, so a misspelt or new required collection passes `deploy:test` and fails live after the grants [deploy/scripts/test-guards.sh:135, deploy/scripts/bootstrap-db.sh:28]
- [x] [Review][Patch] Bootstrap happy path does not assert `GRANT CONNECT ... TO "stub-db_app_user"` or `connect_timeout=10` [deploy/scripts/test-guards.sh:124]
- [x] [Review][Patch] Relative export dir: under `mise run` the task runs from the config root, so resolving before `lib.sh`'s `cd` changes nothing; resolve against `MISE_ORIGINAL_CWD` and test a relative path [deploy/scripts/import.sh:5]
- [x] [Review][Patch] `.secure.deploy.env.example` token comment still names the `postgres-client` tag [.secure.deploy.env.example:5]
- [x] [Review][Patch] New `deploy/README.md` lines run past the file's ~120-column wrap [deploy/README.md:9-18,31-40,63-72]
- [x] [Review][Defer] Broken reflow in the Production infrastructure paragraph ("so\nthere is no SSH tunnel. Secrets live\nonly") [CLAUDE.md:130] — deferred: agent-context file

Rejected:
- Spec record stale (`Status: done`, "7 rows", pass-2 hub items not marked superseded, "io-workhop" typo) — fix edits the spec under review; refreshed at the status update.
- Spec Never "no `deploy:*`" vs `deploy:test` — pre-existing spec wording.
- `realpath -m` GNU-only / empty result — toolchain is Linux; GNU `-m` does not fail on missing paths.
- No missing-secret case for `TF_VAR_pg_cluster_name`/`TF_VAR_pg_client_tag` — low; Terraform still refuses an unset variable with no default.
- Client tag not validated at plan time — low; a data lookup would still pass an existing wrong tag.
- Admin password stored in `.secure.deploy.env` undocumented as a risk — md-directed design; README says it can be blanked after bootstrap.
- 5-connection pool cap basis — still true for the smallest tier; Story 11.10 sizes the pool.
- Importer has no connect timeout — importer is out of scope (not edited); fails, does not corrupt.
- conninfo quoting of user/TMPDIR with spaces — DO identifiers and `mktemp` paths carry no spaces.
- Caller-exported deploy vars skew `deploy:test` — `deploy:test` does not load `.secure.deploy.env`.
- `prevent_destroy` blocks a plan after a cluster rename — false: refusing to destroy the user is the intent.
- Bootstrap guard cases always set `EDGE_SSH` — low; would only hide a re-added requirement that fails loudly.

## Spec Change Log

- 2026-10-23, user-directed rework (md): PostgreSQL moved to the io-workshop hub's shared cluster `io-workshop-pg`. Amended: cluster and database firewall removed from Terraform (data source plus the `postgres-client` tag instead); `doadmin` credentials read from the hub's state (`HUB_DIR`); bootstrap SQL is the hub's recipe; no tunnel, importer and bootstrap use `verify-full` on the public host. KEEP: guard scripts, per-task secret loading, `deploy:test`. Avoids: a second cluster and a firewall resource that overwrites the hub's rules.
- 2026-10-25, user-directed (md): no link to the hub repo. `HUB_DIR` and reading `admin_uri` from the hub's Terraform state removed; the admin credentials (`PG_ADMIN_USER`, `PG_ADMIN_PASSWORD`), cluster name (`TF_VAR_pg_cluster_name`) and client tag (`TF_VAR_pg_client_tag`, no defaults) are entered in `.secure.deploy.env`; docs no longer name hub commands. KEEP: everything else from review pass 2.

## Review Triage Log

### 2026-10-23 — Review pass
- verdicts: 29 findings (blind 11, edge-case 14, verification-gap 3 plus 3 other; intent-alignment descriptive) — high 0, medium 0, low 6 patched, remainder rejected/deferred (not itemised per layer)
- findings:
  - `[low]` `patch` EXIT trap overwritten by open_tunnel, scratch dir leaked (blind, edge, gap) — one shared cleanup.
  - `[low]` `patch` bootstrap-db.sh had no clean-tree guard — added, with a test row.
  - `[low]` `patch` empty terraform outputs gave opaque errors — checked before any tunnel.
  - `[low]` `patch` ssh key unquoted in cloud-init YAML — jsonencode.
  - `[low]` `patch` only refusal paths tested — happy path (env stripping, verify-ca, ssh -L) and failing `docker ps` rows added.
  - `[low]` `patch` README garbled bootstrap sentence; known_hosts after droplet replace — fixed.
  - `[low]` `reject` `groups: [docker]` before group exists, image slug ubuntu-26-04, droplet hardening — identical to mal_ui, which runs in production.
  - `[low]` `reject` no `prevent_destroy`, relative export path vs cd, classpath last-line parsing (same as db_import.sh), untracked export marks tree dirty (migration-export/ is gitignored), "all secrets stripped" claim (terraform legitimately gets them).
  - `[low]` `defer`→`reject` `docker ps --filter name=bp_back` and CI wiring of `deploy:test` — compose names and release tooling arrive in Story 11.10.


### 2026-10-23 — Review pass 2 (shared-cluster rework, cross-checked against io-workhop-hub/postgres)
- verdicts: 29 findings (adversarial 12, edge-case 11, verification-gap 6, with overlap); VPC mismatch dismissed (md: the edge sits in fra1's default VPC, as the cluster does)
- findings:
  - `patch` `db:bootstrap` always failed: the importer reads required export files before Flyway — seeds `[]` per collection.
  - `patch` bootstrap required unused `EDGE_SSH` — dropped.
  - `patch` no Terraform in `mise.toml` — `terraform = "1.15"`.
  - `patch` `bag_please_app` had no `prevent_destroy` — added.
  - `patch` token-scope comment promised a scope DO cannot grant and missed tag/database read; Spaces-key and token blast radius undocumented — rewritten.
  - `patch` runbook omitted the hub's `mise run apply` (edge SSH for `db:import`) and `postgres:init` — added; `load_admin` now names an uninitialised hub.
  - `patch` NFR-D3/README overstated isolation (hub also trusts `trusted_apps` and every project's tagged droplet) — reworded.
  - `patch` relative export dir resolved against the repo root — resolved against the caller's directory.
  - `patch` psql hung on a dropped admin IP — `connect_timeout=10`.
  - `patch` tests: bootstrap happy path (conninfo, PGPASSWORD, grants, seeded export, no leaks), `HUB_DIR` in the leak check, terraform output never sees the token, CA file content, empty output, uninitialised hub, example file vs `require_env`.
  - `patch` this spec described the pre-rework design and claimed `done` — updated, status `review`.
  - `reject` hub values read via `terraform_remote_state` — documented as mirrored instead (the bucket key already couples the stacks; a lookup by name fails loudly).
  - `reject` URL-decoding `admin_uri` (DO generates URL-safe passwords; revisit if bootstrap reports an auth failure), importer pool cap (one-off run, one transaction).

## Verification

**Commands:**
- `cd deploy/terraform && terraform init -backend=false && terraform validate && terraform fmt -check -recursive` -- expected: success
- `mise run deploy:test` -- expected: every matrix row passes
- `bash -n deploy/scripts/*.sh && shellcheck deploy/scripts/*.sh` -- expected: clean
- `git check-ignore -v deploy/terraform/.terraform.lock.hcl` -- expected: no match

## Auto Run Result

Status: review (repository artifacts done; live verification pending md)

- Summary: `deploy/terraform/` (droplet carrying the client tag, firewall, data source for the shared cluster, db `bag_please`, user `bag_please_app`, CA data source, lock file), `.secure.deploy.env.example`, `deploy/scripts/` and mise tasks `infra:plan`, `infra:apply`, `db:bootstrap`, `db:import`, `deploy:test`, `deploy/README.md` runbook, CLAUDE.md section, Zed tasks.
- Review: patches applied 6 (low); deferred 0; rest rejected per log. Follow-up review recommended: false.
- Verification: `terraform init -backend=false`, `validate`, `fmt -check` pass; `shellcheck` clean; `mise run deploy:test` 7 rows pass; lock file not ignored. Guard tests were not observed failing first.
- NOT run (needs md's DigitalOcean account): `infra:plan`/`apply`, `doctl` slug confirmation, `db:bootstrap`, the `verify-full` psql from the droplet (if it fails, AD-14 returns to md), the `db:import` dry run. Sprint status stays `review` until those are done.
- Review pass 3 (2026-10-26, the 2026-10-25 "no hub link" rework): 7 patches applied (admin credentials kept out of terraform/git, bootstrap list checked against the importer by `MongoImportTest`, relative export dir via `MISE_ORIGINAL_CWD`, owner-neutral planning docs, test assertions), 1 deferred, 12 rejected. Re-verified: `mise run deploy:test` 13 checks pass, `shellcheck` clean, `terraform fmt -check` clean, `MongoImportTest` 13/13 (JUnit XML); each new guard assertion and the new importer test were observed failing first.
- Rework (2026-10-23): see Spec Change Log; the review above applied to the earlier cluster-owning design, the reworked parts were re-checked with validate/shellcheck/`deploy:test` only.
- Residual risks: `s-1vcpu-1gb`, the Ubuntu image slug and prices are unconfirmed; the bootstrap recipe is unverified against this database until md runs it; `psql` is needed locally; a wrong client tag in `.secure.deploy.env` plans cleanly but every connection is refused.
