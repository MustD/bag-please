---
title: 'The new home exists in Terraform (Story 11.9)'
type: 'feature'
created: '2026-10-23'
status: 'done'
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

**Problem:** Production has no declared home: no droplet, no managed PostgreSQL, no tunnel path to it, and no way for md to bootstrap the database or run the import against it without leaking a secret.

**Approach:** `deploy/terraform/` (mal_ui layout) declares the droplet, its firewall, a PostgreSQL 18 cluster with a droplet-only firewall, database `bag_please` and user `bag_please_app`; `deploy/scripts/` and the mise tasks `infra:plan`, `infra:apply`, `db:bootstrap`, `db:import` drive it with secrets loaded per task from a gitignored `.secure.deploy.env` (committed blank `.example`).

## Boundaries & Constraints

**Always:** Terraform `~> 1.15`, provider `digitalocean ~> 2.106`; VPC and SSH key are data sources; droplet `ignore_changes = [user_data, image]`; firewall inbound only 80 and 22 from `${edge_private_ip}/32`; S3 backend bucket `io-workshop-tfstate`, key `bag-please/web.tfstate`; `.terraform.lock.hcl` committed, own `.gitignore`. Cluster: PostgreSQL 18, one node, cheapest tier, same VPC; `digitalocean_database_firewall` has exactly one rule, `droplet` = the droplet. Secrets reach only the process that needs them: tasks load `.secure.deploy.env` themselves, `lib.sh` strips every deploy variable before any nested Gradle/mise task, nothing exported into the operator's shell, DB credentials read from `terraform output` and passed only as the `IMPORT_DB_*` env of the `java` command (importer uses `verify-ca`). `doadmin` is used by `db:bootstrap` only. `db:import` refuses a dirty tree and refuses while `bp_back` runs on the droplet. Docs move with behaviour: new `deploy/README.md`, root `CLAUDE.md`, Zed tasks re-synced.

**Never:** No `terraform apply` or any DigitalOcean call without md; no secret, state or tfvars committed; no deploy tasks, droplet compose, `deploy:*` or `.secure.build.env` (Story 11.10); no runtime change to `bp_back`; the importer is not edited.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Missing secret | `.secure.deploy.env` blank | script stops naming the variable | exit 1 |
| Dirty tree | uncommitted change | `db:import` refuses before any tunnel | exit 1 |
| Backend running | `bp_back` container up on droplet | `db:import` refuses | exit 1 |
| Missing export | no export dir | `db:import` refuses before any tunnel | exit 2 |

</intent-contract>

## Code Map

- `/home/md/projects/personal/mal_ui/deploy/terraform/*`, `deploy/scripts/{lib,infra}.sh`, `mise.toml` infra tasks -- reference layout to mirror (state key and names changed to bag-please).
- `mise/db_import.sh`, `bp_back/src/import/.../MongoImport.kt` -- importer takes `IMPORT_DB_*` env + export dir; a dir with no `<collection>.json` loads zero rows after Flyway, which is how `db:bootstrap` runs Flyway as `bag_please_app`.
- `mise.toml`, `.zed/tasks.json` -- new tasks; `mise run zed:sync`.
- `.gitignore` -- already covers `.secure.*.env`, `*.tfstate*`, `*.tfvars`, `.terraform/`; `.terraform.lock.hcl` must not be ignored.
- `CLAUDE.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml` -- docs and 11-9 status.

## Tasks & Acceptance

**Execution:**
- `deploy/terraform/{versions,main,variables,outputs}.tf`, `cloud-init.yaml.tftpl`, `.gitignore` -- droplet, firewall, cluster, db, user, DB firewall, CA data source; outputs incl. sensitive DB credentials -- AD-11
- `deploy/terraform/.terraform.lock.hcl` -- `terraform init -backend=false`, committed -- AR-E11-19
- `.secure.deploy.env.example` -- every variable the tasks read, blank, one comment each -- AD-12
- `deploy/scripts/{lib,infra,bootstrap-db,import}.sh` -- tunnel helper, guards, credentials as env of one process -- AD-9
- `mise.toml`, `.zed/tasks.json` -- `infra:plan`, `infra:apply`, `db:bootstrap`, `db:import` loading only `.secure.deploy.env`
- `deploy/scripts/test-guards.sh` -- runs each I/O matrix row against the scripts with stubbed `terraform`/`ssh`/`git` on PATH and asserts the refusal and that no tunnel (`ssh -L`) was started; wired as mise task `deploy:test` -- matrix coverage
- `deploy/README.md`, `CLAUDE.md` -- runbook with droplet size/price and DB slug record, tunnel and verify-full check
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- 11-9 status

**Acceptance Criteria:**
- Given `deploy/terraform/`, when `terraform init -backend=false && terraform validate && terraform fmt -check` run, then all pass; the lock file is tracked and `git check-ignore` does not match it.
- Given the committed files, when `git grep` for token/password values runs, then none; `.secure.deploy.env.example` lists every variable the scripts `require_env`, all blank.
- Given scripts, when `shellcheck`/`bash -n` run and the guard cases of the matrix are run, then they refuse as specified without opening a tunnel.
- Given a real DigitalOcean account (md), when `infra:plan` runs, then the plan shows the resources above; the live steps (apply, bootstrap, `verify-full` psql from the droplet, import dry run) are documented in `deploy/README.md` and reported as not run here.

## Spec Change Log

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


## Verification

**Commands:**
- `cd deploy/terraform && terraform init -backend=false && terraform validate && terraform fmt -check -recursive` -- expected: success
- `mise run deploy:test` -- expected: every matrix row passes
- `bash -n deploy/scripts/*.sh && shellcheck deploy/scripts/*.sh` -- expected: clean
- `git check-ignore -v deploy/terraform/.terraform.lock.hcl` -- expected: no match

## Auto Run Result

Status: done (repository artifacts only; live verification pending md)

- Summary: `deploy/terraform/` (droplet, firewall, PostgreSQL 18 cluster, db `bag_please`, user `bag_please_app`, single-rule DB firewall, CA data source, lock file), `.secure.deploy.env.example`, `deploy/scripts/` and mise tasks `infra:plan`, `infra:apply`, `db:bootstrap`, `db:import`, `deploy:test`, `deploy/README.md` runbook, CLAUDE.md section, Zed tasks.
- Review: patches applied 6 (low); deferred 0; rest rejected per log. Follow-up review recommended: false.
- Verification: `terraform init -backend=false`, `validate`, `fmt -check` pass; `shellcheck` clean; `mise run deploy:test` 7 rows pass; lock file not ignored. Guard tests were not observed failing first.
- NOT run (needs md's DigitalOcean account): `infra:plan`/`apply`, `doctl` slug confirmation, `db:bootstrap`, the `verify-full` psql from the droplet (if it fails, AD-14 returns to md), the `db:import` dry run. Sprint status stays `review` until those are done.
- Residual risks: `db-s-1vcpu-1gb`, `s-1vcpu-1gb`, the Ubuntu image slug and prices are unconfirmed; bootstrap SQL (`GRANT ... TO doadmin`, `ALTER DATABASE ... OWNER`) unverified on managed PostgreSQL and does not alter the `public` schema owner explicitly; `psql` is needed locally.
