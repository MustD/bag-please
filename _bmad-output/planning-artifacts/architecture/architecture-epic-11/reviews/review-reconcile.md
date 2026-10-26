---
title: 'Epic 11 spine — reconcile review against PRD + addendum'
date: 2026-10-21
spine: _bmad-output/planning-artifacts/architecture/architecture-epic-11/ARCHITECTURE-SPINE.md
inputs:
  - _bmad-output/planning-artifacts/prd.md (Epic 11 scoping, FR70–FR74, NFR2, NFR17, NFR-D1..D6, Epic 11 risk rows, FR44/FR56/FR66/FR69)
  - _bmad-output/planning-artifacts/addendum.md (Epic 11 section)
verdict: 'PASS WITH GAPS — no FR is uncovered, but 2 data-integrity gaps in the import and 1 dropped memlog decision need fixing before stories are written'
---

# Reconcile review: Epic 11 spine vs. PRD + addendum

The spine covers every Epic 11 FR and NFR at the decision level. The gaps are in the quieter parts: details of the
one-time import that real production data will hit, one memlog decision that never made it into the spine, and an
open question that the spine records as settled. Code was checked where a PRD expectation depends on current
behaviour (`bp_back/src/main/kotlin/...`).

Severity: **High** means a story built from the spine would fail or break a "must". **Medium** means a PRD
expectation is left implicit or ambiguous. **Low** means wording, traceability or docs.

## A. Deliberate overrides: need a PRD amendment, not counted as misses

| # | PRD text | Spine | Action |
|---|----------|-------|--------|
| A1 | NFR-D4: "A written restore procedure exists and has been tried once before cutover." Risk row "Managed database unreachable or lost": "restore procedure written down and tried once before cutover". | Deferred → Backups: drill skipped; managed daily backups + manual Mongo-backup fallback (md, 2026-10-21) | Amend NFR-D4 **and** the risk-mitigation row. The row is a second copy that would otherwise keep the old promise. |
| A2 | NFR17: E2E "must pass with zero failures before any story in any epic is marked done". | AD-15: E2E may be red between stories on `epic-11`; full gate at the single merge to `main` | Amend NFR17 with a scoped Epic 11 exception, and carry it into `epics.md`. The PRD's own note (Responsive Design) records that NFRs living only in the PRD caused a contradiction that lasted three epics. |

## B. Misses, mis-carries and contradictions

### High

**B1. The import FKs will reject real data: the nil-UUID category sentinel and dangling references.**
FR71 requires that "the relations between them stay intact" and that the import either loads everything or nothing.
`MongoItem.category` defaults to `UUID(0, 0)` (`entity/item/mongo/MongoItem.kt:18`), so any legacy item without a
category is exported with the nil UUID. AD-7 and the ERD make `items.category_id` an FK to `categories`. Other
references can also dangle: membership arrays or `list_members` documents left over from before the Epic 9
membership purge, and items whose category was deleted before category delete started cascading (Epic 9). With
AD-9's single transaction, one bad reference rolls back the whole import. The spine says nothing about:
whether `category_id` is nullable or how the sentinel maps; what the importer does with a dangling reference
(refuse with a named report, or drop and count it); and how such drops appear in the per-type "export vs loaded"
counts. A silent drop would also break FR71's count promise.

**B2. A lazily seeded `app_config` row can make the import refuse forever.**
`ApplicationConfigRepository.load()` upserts a default row on its first read. `AuthRoutes` reads it for
`registrationEnabled`, so one visit to the login page seeds it. AD-9 refuses "if any application table holds a
row". The importer reaches the database through the droplet, so the backend is deployed and running before the
import. One request to it (a manual check, or `deploy`'s smoke test if the edge already points there) makes the
target non-empty, and FR71's "refuses to run against a database that already holds application data" then blocks
the cutover. The spine needs a rule here: the backend writes nothing until the import has run (for example, deploy
with the edge not yet pointed at it and nobody touching it), or the importer treats a lone default `app_config`
row as empty, or seeding moves into `V1__baseline.sql` and the importer overwrites it.

**B3. A memlog decision is missing from the spine: the droplet compose publishing and hardening rules.**
Memlog decision 5.4 (md): `bp_front` is published on the private IP `:80` only, `bp_back` is internal only, the reference project
hardening applies (`read_only`, `cap_drop: [ALL]`, `no-new-privileges`, `mem_limit`), and `-Xmx` is set
explicitly. The addendum states the same ("Only the web container is published, and only on the private IP"). The
spine carries only the word "(hardened)" in the Structural Seed and the deferred sizing values. No AD binds the
port-publishing rule, which is what keeps `bp_back` (and its rate limiter's trust of `private_ranges`) off any public
interface. Add it to AD-11 or AD-13, or as its own AD.

### Medium

**B4. NFR-D5's export deletion is not carried, and the "Mongo backup fallback" contradicts NFR-D5. It is still an open question.**
NFR-D5 says the export "is deleted once the import is verified". AD-9 and the deferred cutover sequence
(export → import → verify → repoint → retire) never say to delete it. Deferred → Backups also names "a manual
restore from the Mongo backup" as md's fallback. The memlog's last entry asks exactly this question ("which artifact
is kept, where, and for how long?") with no answer, yet the spine presents the fallback as settled. Either add
"delete `migration-export/` after verification" to the runbook and to AD-9, and name the backup artifact, its
location (outside the repo, NFR-D1 "any data export") and its retention, or record it as an open question that
needs an NFR-D5 amendment.

**B5. The unique `users.username` constraint is not carried.**
The Consistency Conventions index list carries the Mongo index intents but drops the only **unique** one:
`users.username` (`UserRepository.kt:23`). FR26 (reserved admin name), FR39 (share by exact username) and login
all depend on usernames being unique. The convention "others only with a reason" makes leaving it out look
deliberate. The case rule (is uniqueness case-sensitive, as in Mongo today?) is also unstated. The
`list_members(list_id, user_id)` PK covers membership uniqueness, but the categories-per-list uniqueness intent, if
any, is also not stated.

**B6. AD-1's "no replacement cache anywhere" leaves the existing config cache ambiguous.**
`ApplicationConfigService` holds an `AtomicReference` cache today. NFR12 permits it, and FR22 needs writes to take
effect immediately. AD-1 deletes three named Storages and forbids any new cache, but it never says whether this
cache stays or goes. Builders will disagree. State it: keep it (NFR12, a single instance, invalidated on write),
or drop it.

**B7. The FR74 smoke test cannot verify the new droplet before cutover.**
AD-13's deploy smoke-tests `https://bag-please.io-workshop.net/` through the edge. Until the edge is repointed
(cutover step 4), that URL serves the **old** deployment, so the first deploys report success without having
reached the new droplet. The PRD cutover requires the new deployment to be checked before the edge moves. The
spine needs a pre-cutover check of the droplet itself (for example `/api/health` over `ssh -J`), or it should
state that `deploy` before cutover proves only the containers' health.

**B8. Addendum point "how ObjectIds and dates map to rows" is only partly decided.**
Arrays are decided (stores → `text[]`, members → `list_members`). How relaxed-EJSON `{"$date": …}` values and
string-encoded UUID `_id`s are parsed into `timestamptz` and `uuid` is implied by AD-6 but never stated as an
importer rule. The spine should also state its assumption that no collection uses ObjectId `_id`s (true for
`app_config`, which uses a fixed UUID). Small, but it is an explicit "point to settle".

**B9. The importer does not check that the source is fully migrated (FR69 / FR47 history).**
AD-5 drops the Mongo-era migrations because "the import brings data that is already migrated". FR69 ("no store
data is lost") then holds only if the export came from a database where `epic9-multi-store` has run. Nothing makes
the importer refuse or report on documents that still carry the legacy `store` field or lack `listId`. Add a
precondition: the importer refuses an export that contains legacy fields, or requires the `app_migrations`
completion records in the export.

**B10. The replacement for the root CLAUDE.md "dump before a migration release" section is unspecified.**
The addendum says `pg_dump` and the managed backups replace CLAUDE.md's mongodump/restore section. The spine
supersedes the section ("AD-5, Deferred (backups)"), but Flyway migrations are just as irreversible, and the
Deferred section skips backups entirely. That leaves no documented pre-migration dump or rollback procedure for
later releases. The spine should say what replaces the section: a `pg_dump` over the tunnel before a release that
adds a migration, or explicitly nothing.

### Low

**B11. `crash.log` is missing from the gitignore list.** The addendum lists the reference project's `deploy/terraform/.gitignore`
entries, including `crash.log`, which can contain provider secrets. AD-12's list leaves it out. NFR-D1 requires the
patterns to cover every secret-bearing path before the first such file exists.

**B12. The `db_data` volume and the docs updates are only implied.** Addendum point 6 names the `mongo` service, the
`db_data` volume, and (via the memlog direction) `bp_back/CLAUDE.md`'s layering text. AD-16 says "a named
volume", and AD-15 says Mongo leaves "docs", but neither names `db_data`'s removal, the rewrite of `bp_back/CLAUDE.md`,
the root CLAUDE.md compose/dev commands (`docker compose up mongo bp_back`), or the retirement of
`project.example.env` (folded into `.secure.build.env`). Make these explicit retirement items.

**B13. The `binds` list is incomplete.** The spine changes behaviour that FR44 (stores `text[]`), FR54 (scheduler
indexes), NFR-L1 (the `takeWhile` re-check), NFR12/FR22 (config) and FR37 (the delete cascade and events) depend
on, but its frontmatter `binds` lists only FR56, FR66 and NFR-L2 outside Epic 11. FR69, FR47 and NFR-L3 are retired
by AD-5 and should appear as "retired" for traceability.

**B14. The importer ships in the production image.** `MongoImport` is a second main inside `bp_back`, so the
production artifact carries Mongo-parsing code (and possibly a BSON dependency). That sits uneasily with FR70's
"MongoDB is not part of any environment" and AD-15's "Mongo is gone from code" merge criterion. Say whether the
importer and its dependencies are removed after cutover, or exempted.

## C. Checks that pass (for the record)

FR70 (AD-1/16), FR71 core (refuse non-empty, per-type counts, password hashes carried, refresh tokens not carried:
AD-9), FR72 (AD-5), FR73 (AD-11), FR74 (AD-13: one command, `deploy:status`), NFR2 (AD-10), NFR-D1 (AD-12 apart from
B11), NFR-D2 (state in Spaces, per-task secret loading), NFR-D3 (AD-11/14), NFR-D6 (AD-11 + deferred sizing),
FR56 (AD-4), FR66 survive-deletion (AD-6), FR44 order/casing (AD-6), cutover order and "old deployment retired only
after" (Deferred runbook), "2 real users' data must carry over" (AD-9).

## D. Addendum "Points for architecture to settle"

| Point | Status in spine |
|-------|-----------------|
| Export format; ObjectId/date/nested-array mapping | **Decided** for format (AD-9) and arrays (AD-4, AD-6). **Partly open** for date/id parsing (B8). |
| Import location and reach (Gradle task / main / script; via droplet or temporary IP) | **Decided**: AD-9, second main + SSH tunnel through the droplet (a third option, consistent with NFR-D3) |
| NFR2 refresh-token purge | **Decided**: AD-10, read-time reject + hourly sweep step |
| JWT secret/admin creds delivery on the droplet | **Decided**: AD-12, deploy-written `.env`, mode 600, owned by `deploy` |
| NFR-D1 no automated secret scan; patterns before first secret | **Decided**: AD-12 (gitignore before first file). Missing `crash.log` (B11). |
| Retire Mongo-era pieces (Migration.kt/app_migrations, mongo/ packages, mongo service + db_data, CLAUDE.md dump section → pg_dump + managed backups) | **Mostly decided** (AD-1, AD-5, AD-16, Superseded table). The `db_data` removal is implicit and the replacement for the CLAUDE.md section is undefined (B10, B12). |
| E2E stack runs PostgreSQL in Compose | **Decided**: AD-16 |
