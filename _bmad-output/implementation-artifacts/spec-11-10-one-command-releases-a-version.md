---
title: 'One command releases a version (Story 11.10)'
type: 'feature'
created: '2026-10-26'
baseline_revision: '401614efbe61fb169ca0d976b950a7f1b9f2d6e2'
status: 'done'
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

**Problem:** The droplet and database exist (Story 11.9) but nothing builds, publishes or rolls a version onto the droplet, nothing says what runs there, and the old `images:build-push` pushes `latest` and can silently overwrite a published tag.

**Approach:** A hardened `deploy/docker-compose.yml` plus scripts in `deploy/scripts/` behind mise tasks `deploy:build`, `deploy:push`, `deploy [version]`, `deploy:status`, each loading only the `.secure.*.env` it needs; the old image task and `project.env` are retired; `deploy/README.md` becomes the operator runbook and root `CLAUDE.md`'s Mongo dump/restore section becomes a pointer to it.

## Boundaries & Constraints

**Always:** Droplet compose: `bp_front` published only on `${PRIVATE_IP}:80`, `bp_back` unpublished; both `read_only`, `tmpfs: [/tmp]`, `cap_drop: [ALL]` (`bp_front` adds `NET_BIND_SERVICE`), `no-new-privileges:true`, a `mem_limit`; `bp_back` `JAVA_OPTS` carries an explicit `-Xmx`; `KTOR_DB_SSLMODE: verify-full` and `KTOR_DB_SSLROOTCERT: /etc/bag-please/ca-certificate.crt` hardcoded, the CA mounted read-only; `bp_front` healthcheck is busybox `wget` of `http://127.0.0.1/api/health`. Images are `${DOCKER_IMAGE_*}:${BP_VERSION}`, never `latest`. Every variable named in `.secure.deploy.env.example`, every `TF_VAR_*` and every `KTOR_*` is stripped before any nested Gradle/mise task. Secrets reach the droplet only as stdin of `ssh` into `bag-please/.env` (mode `600`, owner `deploy`; written via temp file + `mv` under `umask 077`), never argv or a repo file; DB values come from `terraform output` and an empty/null one aborts naming it. `ca-certificate.crt` mode `644`. Dirty tree is refused by every deploying task. On failure `deploy` prints the rollback command (`mise run deploy -- <previous version>`, previous read from the droplet's old `.env` before overwrite, else a placeholder) and never rolls back itself. R2DBC pool max is 5 (Story 11.9 README promises it). Zed tasks re-synced; `sprint-status.yaml` 11-10 -> done at close; test totals read from JUnit XML.

**Never:** No `latest` tag pushed or referenced; no secret in an image, compose file, argv or committed file; no Terraform run by a deploy; no cutover step (`infra:apply`, `db:bootstrap`, `db:import`, edge repoint) is performed; `V1__baseline.sql` untouched; the implementer runs nothing against DigitalOcean, Docker Hub or the droplet (live verification is md's, in the runbook).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Push, tag free | `docker manifest inspect` says `no such manifest` for both images | builds, pushes `:<version>` only | — |
| Push, tag exists | manifest inspect succeeds for either image | refuse, name image:tag, nothing built/pushed | exit 1 |
| Push, hub unreachable | manifest inspect fails with any other error | refuse "cannot query" | exit 1 |
| Deploy, new version | clean tree, tag free | `back:test`, build+push, `.env`/CA/compose written, `pull`, `up -d --wait`, smoke `/api/health` = `OK` via edge | any failure: rollback hint, non-zero |
| Deploy `<version>` | tag already on hub | no test/build/push; same remote steps; rollback | tag absent: refuse |
| Dirty tree | uncommitted change | refuse before any network/docker call | exit 1 |
| Empty DB output | e.g. `db_app_password` empty | refuse naming it; nothing sent to the droplet | exit 1 |
| Status | droplet reachable | prints running version(s) and HTTP status of `https://bag-please.io-workshop.net/` | droplet unreachable: say so, still print HTTP status |

</intent-contract>

## Code Map

- `deploy/scripts/lib.sh` -- `unset_deploy` (hardcoded list today; make it derive names from `.secure.deploy.env.example` + `TF_VAR_*` + `KTOR_*`, and `.secure.build.env.example`), `remote`, `tf_out`/`need_out`, `require_clean_tree`, `make_scratch`; add version reader, `hub_tag_exists`, runtime-output loader (private_ip, db_host, db_port, db_name, db_app_user, db_app_password, db_ca_certificate), `PUBLIC_URL=https://bag-please.io-workshop.net/`.
- `deploy/scripts/test-guards.sh` -- stub-PATH harness (terraform/ssh/git/psql/gradle/java stubs, `run_case`, env-example check, LEAK regex); extend with `docker`, `mise`, `curl`/`scp` stubs and the matrix rows above; the env-example check already requires every `require_env` variable to be blank in the example.
- `deploy/scripts/{import,bootstrap-db,infra}.sh` -- patterns to follow; `run_importer` shows the nested-Gradle strip.
- `mise.toml` -- tasks block `[tasks."deploy:test"]`, `images:build-push`; `env = { _ = { file = ... } }` per task. `.zed/tasks.json` regenerated by `mise run zed:sync`.
- `mise/images-build-push.sh`, `project.example.env` -- delete; `.gitignore` line `project.env` stays so a leftover local file is never committed. `.secure.deploy.env.example` -- add `KTOR_JWT_SECRET`, `KTOR_ADMIN_LOGIN`, `KTOR_ADMIN_PASS` (blank, commented). New `.secure.build.env.example`: `DOCKER_IMAGE_BACK`, `DOCKER_IMAGE_FRONT`.
- `bp_back/Dockerfile` (start script honours `JAVA_OPTS`, entrypoint `/app/bin/bp_back`), `bp_front/Dockerfile` (`caddy:2-alpine`, listens :80; Caddy writes `/config` and `/data`, so a read-only root likely needs extra tmpfs there -- verify), `routing/Caddyfile` (`/api/*` -> `bp_back:4000`).
- `bp_back/src/main/kotlin/com/bagplease/plugins/Database.kt` -- `PostgresConfig.r2dbcUrl()` builds the pool URL; add `maxSize=5` (r2dbc-pool query option) via a config key; `application.yaml` `db.postgres`; existing config/URL tests under `bp_back/src/test`.
- `bp_back/.../plugins/Routing.kt` `/health` (200 `OK` / 503) -- the healthcheck/smoke target. Admin login comes from `KTOR_ADMIN_*`; startup writes no `users`/`app_config` row, so a smoke deploy leaves `app_config` empty.
- `deploy/README.md` (Story 11.9 runbook; extend), root `CLAUDE.md` (lines ~108-112 image task text; the "Dump before a migration release" section), `routing/edge-proxy.md` (describes only the local 2080 upstream; cutover story edits it, not this one), `deploy/terraform/cloud-init.yaml.tftpl` (deploy user, docker group, remote dir is `~deploy/bag-please`).

## Tasks & Acceptance

**Execution:**
- `deploy/docker-compose.yml` -- hardened droplet compose per Always; env via explicit `environment:` with `${VAR:?}` for secrets; `up --wait` capable healthchecks; sizes: `bp_back` `mem_limit: 512m`, `-Xmx256m`, `bp_front` `64m` (droplet is 1 GB + 1 GB swap) -- confirm by running it locally
- `deploy/scripts/lib.sh` -- derive strip list; add helpers listed in Code Map
- `deploy/scripts/{build,push,deploy,smoke,status}.sh` -- `build.sh` builds both images tagged `:<version>` from `gradle.properties`; `push.sh` checks both tags absent, builds, pushes; `deploy.sh [version]` per matrix; `smoke.sh` runs `curl -fsS http://<private ip>/api/health` on the edge via `ssh $EDGE_SSH` with a few retries and requires `OK`; `status.sh` per matrix
- `mise.toml` -- add `deploy:build`, `deploy:push` (build env only), `deploy`, `deploy:status` (deploy env; `deploy` both files); remove `images:build-push`; `mise run zed:sync`
- `mise/images-build-push.sh`, `project.example.env` -- delete; add `.secure.build.env.example`; extend `.secure.deploy.env.example`
- `bp_back/.../Database.kt`, `application.yaml` (+ a test, observed failing first) -- pool `maxSize` 5 in the R2DBC URL
- `deploy/scripts/test-guards.sh` -- cases for every matrix row plus: nested `env` dump through the `back:test` stub shows no deploy/`KTOR_*` variable; no `latest` tag in any docker call; `.env` is written over ssh stdin with `umask 077` and mode 600, CA mode 644; compose file parses (`docker compose config` with dummy vars) and asserts the hardening keys
- `deploy/README.md`, `CLAUDE.md` -- runbook (infra, bootstrap, import, deploy, status, rollback, AD-20 cutover order, managed daily backups, optional `pg_dump` before a migration release, one-time `docker login` on the droplet if images are private); replace the dump/restore section with a pointer; update Commands text for the new tasks and `.secure.build.env`

**Acceptance Criteria:**
- Given `deploy/docker-compose.yml`, when parsed with `docker compose config`, then `bp_front` publishes only `${PRIVATE_IP}:80`, `bp_back` publishes nothing, and both carry the hardening keys, `-Xmx` and the hardcoded `verify-full` settings.
- Given `mise run deploy:test`, when it runs, then all guard cases pass, including the nested `env` dump proof (AR-E11-22) and the refusal rows.
- Given `gradle :bp_back:test`, when it runs, then it passes with zero failures.
- Given `mise tasks`, when listed, then `images:build-push` is absent and the four deploy tasks and the Zed list match (`mise run zed:sync` is a no-op afterwards).
- Given the docs, when read, then `deploy/README.md` documents every item in the story's docs criterion and root `CLAUDE.md` points to it with no `mongodump` text left.

## Spec Change Log

## Review Triage Log

### 2026-10-26 — Review pass
- verdicts: 4 layers; findings grouped by root cause — high 0, medium 1, low 3 patched, remainder false/low rejected (per-layer counts not itemised)
- findings:
  - `[medium]` `patch` rollback hint printed only after the droplet was touched, matrix says any failure (edge-case, blind) — hint now on every non-zero exit, "untouched" noted before the first write; guard case added.
  - `[low]` `patch` docker build/push env never asserted free of deploy/KTOR variables (verification-gap) — docker stub dumps env, asserted in the new-version case.
  - `[low]` `patch` compose hardening check skipped silently, tautological jq, `/config` `/data` tmpfs unasserted (verification-gap, edge-case, blind) — missing tool now fails; tmpfs asserted.
  - `[low]` `patch` root CLAUDE.md infra paragraph omitted the deploy tasks (blind) — added.
  - `[low]` `reject` rollback hint after a retried failed deploy names the failed version; half-published tags; no pre-build docker login check; `manifest unknown` wording / first push to a new repo is refused (fails safe); smoke ssh stdin; status exits 0 on 5xx (spec only says print); no deploy lock; missing log rotation (daemon.json has it); pids_limit, image pruning; `|| true` in strip-list derivation; pg_dump runbook detail — rare or fail-safe, fixes add complexity.
  - `[low]` `reject` pool `initialSize` default 10 above `maxSize` 5, no validation, override not in compose — 239 backend tests build the pool from this URL without error; default 5 applies.
  - `[false]` `reject` build.sh lacks clean-tree check (it deploys nothing); sprint-status done vs spec in-progress (finalised below); epic-11-context scope creep (regenerated by this run on purpose); intent audit divergences (stubbed verification is the spec's chosen surface, live checks are md's).

## Design Notes

Tag existence uses `docker manifest inspect <image>:<tag>` (works with the operator's `docker login`, also for private repos): success = exists; stderr containing `no such manifest` = absent; anything else = refuse, because Docker Hub silently overwrites tags. `deploy` reads the running version from `docker compose ps --format '{{.Service}} {{.Image}}'` on the droplet (status) and from the old `.env` (`BP_VERSION=`) for the rollback hint.

Live acceptance that only md can run (documented in the runbook, not executed here): deploy a pre-release tag to the new droplet, see the private-IP smoke test pass while the public URL still serves the old deployment, stop `bp_back` again, and confirm `select count(*) from app_config` is 0.

## Verification

**Commands:**
- `mise run deploy:test` -- expected: `all guard cases passed`
- `gradle :bp_back:test` -- expected: 0 failures (totals from JUnit XML)
- `docker compose -f deploy/docker-compose.yml config` with dummy variables -- expected: valid, hardening keys present
- `shellcheck deploy/scripts/*.sh` (if installed) -- expected: clean
- `mise run zed:sync && git diff --stat .zed` -- expected: only the intended task changes

## Auto Run Result

Status: done

- Summary: `deploy`, `deploy <version>`, `deploy:build`, `deploy:push` and `deploy:status` release and report an exact version onto the droplet; hardened `deploy/docker-compose.yml`; pool max 5; old image task retired; runbook and CLAUDE.md pointer written.
- Files: `deploy/docker-compose.yml`, `deploy/scripts/{lib,build,push,deploy,smoke,status,test-guards}.sh`, `mise.toml`, `.zed/tasks.json`, `.secure.build.env.example`, `.secure.deploy.env.example`, `.gitignore`, `Database.kt`, `application.yaml`, `PostgresConfigTest.kt`, `deploy/README.md`, `CLAUDE.md`, `bp_back/CLAUDE.md`, `sprint-status.yaml`; deleted `mise/images-build-push.sh`, `project.example.env`.
- Review: patches applied 4 (medium 1, low 3); deferred 0; the rest rejected per log.
- Follow-up review recommended: false.
- Verification: `mise run deploy:test` all guard cases passed; `gradle :bp_back:test` 239 tests, 0 failures (JUnit XML, implementer run); shellcheck clean; `docker compose config` valid.
- Residual risks: nothing ran against DigitalOcean, Docker Hub or the droplet; `bp_back` never ran read-only with the production compose; md runs the live acceptance in `deploy/README.md`.
