---
status: blocked
---

# BMad Build Auto Result

Status: blocked
Blocking condition: dirty working tree

## Context

Invocation intent: `8.4` — Story 8.4 "One Filter and Search, on Both List Screens".

Routing resolved before the halt:

- `_bmad-output/implementation-artifacts/spec-8-4-one-filter-and-search-on-both-list-screens.md`
  exists with `status: done` (implemented at `c03ea58`), so this dispatch is a **follow-up review pass**
  (`review_loop_iteration: 0`, `followup_pass: true`) rather than a fresh plan/implement cycle.
- Branch `epic8-ui-ux` fits the intent (Epic 8). No branch mismatch.
- Epic context `epic-8-context.md` is present and valid.

## Why it halted

Step 01 item 3 (version-control sanity check) requires a clean working tree. After
`git add --refresh -- .` the tree still reports:

```
 M .idea/dataSources.xml
```

The change is unrelated to Story 8.4 — an IntelliJ data-source rename plus a Mongo URL change
(`@localhost` -> `@bp-local`, `mongodb://localhost:27017` -> `mongodb://127.0.0.1:27217`). It is
nonetheless a modified tracked file, so any commit this run produced would sweep it in.

`spec_file` was never set (the halt precedes step-01 routing item 5), so this result was written here
instead of into the Story 8.4 spec — the `done` story record is left untouched.

## To unblock

Either commit or revert `.idea/dataSources.xml`, then re-dispatch `bmad-build-auto 8.4`:

```bash
git checkout -- .idea/dataSources.xml   # discard
# or
git add .idea/dataSources.xml && git commit -m "chore(idea): point the local Mongo data source at 127.0.0.1:27217"
```
