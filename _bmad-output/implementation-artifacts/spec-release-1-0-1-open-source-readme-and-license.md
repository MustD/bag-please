---
title: 'Release 1.0.1: open-source README, MIT license, repo tags and links'
type: 'chore'
created: '2026-10-26'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '630c008f5edc10becd3db65dfd3d51f446785869'
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The public GitHub repo `MustD/bag-please` has no README, no LICENSE, and no description, topics or homepage, so a visitor cannot tell what it is, how to run it, or whether they may reuse it. md is about to deploy the latest `main` as 1.0.1.

**Approach:** Add a root `README.md` for open-source readers, an MIT `LICENSE`, and the repo's tags and links. Bump the version from 1.0.0 to 1.0.1 everywhere it is recorded. md creates the git tag after the commit.

## Boundaries & Constraints

**Always:** The README states only what the repository already shows (stack, features, commands, env vars); every command in it must exist in `mise.toml`, `package.json` or `docker-compose.yaml`. Relative links in the README point to files that exist. The copyright line is `Copyright (c) 2026 Ilya Obukhov`. The version is `1.0.1` in `gradle.properties`, `bp_front/package.json`, and both root entries of `bp_front/package-lock.json`.

**Never:** No git tag, push, or deploy (md does those). No secret values, droplet IPs, or contents of `.secure.*.env` in the README. No edits to `CLAUDE.md`, `AGENTS.md`, or the BMAD artifacts beyond this spec. No new CONTRIBUTING, CODE_OF_CONDUCT, or CI files.

**Decisions (md, 2026-10-26):**
- Tags and links = README badges and links, plus the GitHub repo description, topics and homepage, set with `gh repo edit MustD/bag-please`.
- The README links the live instance `https://bag-please.io-workshop.net` as the live demo, and the repo homepage points to it.

</frozen-after-approval>

## Code Map

- `gradle.properties` -- `version=1.0.0`, the source for both image tags (`deploy/scripts/build.sh`)
- `bp_front/package.json:4`, `bp_front/package-lock.json:3,9` -- frontend version, bumped together in the 1.0.0 commit `8af6a31`
- `docker-compose.yaml` -- local stack on `127.0.0.1:2080`; default admin `admin`/`admin`; the `KTOR_*` env vars to document
- `bp_back/src/main/resources/application.yaml` -- full list of `KTOR_*` settings and their defaults (JWT, rate limit, DB, TLS)
- `mise.toml` -- toolchain (`temurin-25`, node 26, gradle 9) and task names (`back:*`, `deploy*`, `infra:*`)
- `deploy/README.md`, `routing/edge-proxy.md` -- production runbook and edge contract; link to them, do not copy them
- `_bmad-output/planning-artifacts/prd.md` -- feature source (FR1–FR74): accounts and admin, shared lists with invites, one-timer and recurring items, multiple stores per item, categories, real-time updates, installable PWA
- `design/` -- design prototypes; optional link
- Stack versions: Kotlin 2.4, Ktor 3.6, graphql-kotlin 11, Exposed 1.6, Flyway 13, PostgreSQL 18; React 19, MUI 9, Apollo Client 4, Vite 8, TypeScript 6

## Tasks & Acceptance

**Execution:**
- [x] `LICENSE` -- standard MIT text with the agreed copyright line -- reuse is explicitly allowed
- [x] `README.md` -- title and one-line pitch, badges (license, version, stack), features, architecture sketch (Caddy → Ktor GraphQL → PostgreSQL), quick start with Docker Compose, local dev (mise, `npm run dev`, gradle tasks), configuration table of `KTOR_*` vars, tests (backend, E2E), deployment pointer to `deploy/README.md`, project layout, license section -- the open-source landing page
- [x] `gradle.properties`, `bp_front/package.json`, `bp_front/package-lock.json` -- 1.0.0 → 1.0.1 -- the release version
- [x] GitHub repo metadata -- `gh repo edit MustD/bag-please --description … --homepage https://bag-please.io-workshop.net --add-topic …` -- tags and links on the repo page (run after the commit is pushed, or immediately — it does not depend on git)

**Acceptance Criteria:**
- Given a fresh clone, when a reader follows the README quick start, then `docker compose up --build` serves the app on `http://localhost:2080` and the stated default admin credentials match `docker-compose.yaml`.
- Given the README, when every relative link is resolved, then each target file exists.
- Given the repo, when `grep -rn "1\.0\.0"` runs on the four version locations, then none remain and all read `1.0.1`.
- Given GitHub, when the repo is viewed, then the license is detected as MIT.

## Implementation Notes

## Spec Change Log

## Review Triage Log

| # | Source | Finding | Verdict | Evidence / route |
|---|--------|---------|---------|------------------|
| 1 | blind, edge, verif | `bp_front/package.json` and lockfile root say `"license": "ISC"` against MIT `LICENSE` | medium | Confirmed at `package.json:3`, `package-lock.json:10`; patched to `MIT` |
| 2 | blind, verif | Static `version-1.0.1` badge drifts on next bump | low | Direct correction; patched to a dynamic GitHub tag badge (md tags 1.0.1) |
| 3 | blind, edge | Run-from-source step clashes with `bp_back` container started just above (port 4000) | medium | Confirmed against `docker-compose.yaml` port mapping; patched to `docker compose up postgres` |
| 4 | blind, edge | Config table merges DB user/password defaults and omits empty `KTOR_DB_SSLROOTCERT` default | low | Confirmed in `application.yaml`; patched with per-variable defaults |
| 5 | blind | "Required" vars have local dev defaults in Gradle `run` and Compose | low | Confirmed `bp_back/build.gradle.kts:21-27`; patched wording |
| 6 | blind | No hardening note; compose sets `KTOR_RATE_LIMIT_ATTEMPTS: 6000` | medium | Confirmed in `docker-compose.yaml`; patched with a change-before-exposing note |
| 7 | blind | Codegen/workflows only via agent `CLAUDE.md` files | low | Patched: one-line codegen summary in README, links kept as architecture notes |
| 8 | blind | No Gradle-wrapper / first-build-time note | low | Direct correction; patched |
| 9 | blind | Live demo link gives no registration/demo-account info | maybe-false | Depends on the runtime registration toggle on production, not visible in repo; would only be low; rejected |
| 10 | blind | Missing CONTRIBUTING, SECURITY, CHANGELOG, issue templates | low | Excluded by frozen intent (Never: no new CONTRIBUTING/CODE_OF_CONDUCT/CI files); rejected |
| 11 | blind | No screenshots | low | Fix is new assets, not a direct correction; rejected |
| 12 | blind | "Installable" names only Android | false | FR59 scopes installability to Chrome on Android; README states exactly that |
| 13 | edge | Secure cookie on `http://localhost` may not persist in Safari | maybe-false | Would need a Safari check; would only be low; rejected |

## Verification

**Commands:**
- `grep -n version gradle.properties bp_front/package.json && sed -n 1,10p bp_front/package-lock.json` -- expected: 1.0.1 in all four places
- `cd bp_front && npm install --package-lock-only` -- expected: lockfile stays consistent, no other diff
- A link check over `README.md` relative paths (script or `ls`) -- expected: all exist
