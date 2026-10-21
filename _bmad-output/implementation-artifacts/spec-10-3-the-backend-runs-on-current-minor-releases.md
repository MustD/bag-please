---
title: 'The backend runs on current minor releases'
type: 'chore'
created: '2026-10-20'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-10-context.md'
  - '{project-root}/bp_back/CLAUDE.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Backend dependencies trail their latest stable minors, so the graphql-kotlin major (10.4) would land on a stale base.

**Approach:** Re-measure on the day, bump every backend dependency below its next major together, bisect and hold only a culprit, update docs naming a moved version in the same commit.

## Boundaries & Constraints

**Always:** Prereleases excluded; `graphql-kotlin` untouched (Story 10.4); totals from JUnit XML; docs naming a moved version updated.

**Never:** `force`/`strictly`, `-Xskip-metadata-version-check`, added `@Suppress`.

</intent-contract>

## Code Map

- `gradle/libs.versions.toml` -- version catalogue (kotlin, ktor, mongodb, logback, kotest).
- `bp_back/Dockerfile` -- `gradle:9.6.1-jdk25` build image.
- `AGENTS.md:64` -- names Gradle 9.6.1 / image.
- `.idea/kotlinc.xml` -- Kotlin version option.

## Tasks & Acceptance

**Execution:**
- `gradle/libs.versions.toml` -- bump to measured latest stable
- `bp_back/Dockerfile`, `AGENTS.md`, `.idea/kotlinc.xml` -- move named versions

**Acceptance Criteria:**
- Given the bumps, when `cleanTest test` and `build` run, then both pass.

## Verification

**Commands:**
- `gradle :bp_back:cleanTest :bp_back:test :bp_back:build` -- expected: success

## Auto Run Result

Status: done. Measured 2026-10-20: Kotlin 2.4.10→2.4.21, Ktor 3.5.2→3.6.0, Mongo driver 5.9.2→5.13.0, Logback 1.6.2→1.6.5, Kotest 6.2.4→6.2.6, `gradle:9.6.1-jdk25`→`9.8.1-jdk25`. Arrow 2.2.3, Testcontainers 2.0.5, bcrypt 0.10.2 already latest stable; graphql-kotlin left for 10.4 (10.2.1; 11.0.0 available). No bisect needed: `cleanTest test build` passed, JUnit XML 175 tests / 0 failures / 0 errors / 0 skipped; `npm run generate` left `src/__generated__` clean; E2E 283 passed, 29 skipped, 0 failed.
