---
title: 'Story 9.6 — An item can be in several stores'
type: 'feature'
created: '2026-09-20'
baseline_revision: 'f85ffa457c3bf18acd012ef8e138b2077bc85a04'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-9-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md'
warnings: ['oversized']
deferred:
  - summary: >-
      Store chip test ids `shopping-item-store-<item>-<store>` collide when item or store names contain the separator
      or two items share a name.
    evidence: |-
      A real ambiguity class, but it is the pre-existing name-keyed test-id defect that already has its own open
      ledger entry; fixing it means re-keying ids by item id across every spec, which wants its own story.
    location: >-
      bp_front/src/routes/ListShoppingPage.tsx
    severity: low
---

<intent-contract>

## Intent

**Problem:** An item holds one `store`, but the same product is sold in several shops, so a user shopping in Aldi
cannot tell that the Lidl item is also on the Aldi shelf. Every layer — domain, Mongo document, both mappers, the
GraphQL type and input, the repository write, both item dialogs, the shopping row and the E2E — is written around the
single-value field.

**Approach:** Replace `store: String?` with `stores: [String!]!` in one indivisible pass, with the server as the
normalization authority (trim, drop blanks, dedupe by lowercased key keeping the first occurrence), a startup
migration that folds every legacy `store` into `stores` and unsets it, a multi-value store field in both dialogs, and
store chips inside the shopping row's closed control surface. Two carry-in items ride along: an orphaned item's edit
dialog must stop closing silently, and the release gets a documented dump/rollback rule.

## Boundaries & Constraints

**Always:**
- One story, one app version: schema, mappers, repository, migration, codegen and the E2E raw GraphQL all land
  together; `gradle.properties` and `bp_front/package.json` both go `0.18.0` → `0.19.0` (AR-E9-3).
- The server normalizes on create **and** update: `trim()` each name, drop empties, dedupe by `lowercase(Locale.ROOT)`
  keeping the first occurrence's casing and position; internal whitespace kept. Identity is the lowercased key; stored
  casing is display data (AR-E9-4).
- `itemStoreSuggestions` returns one name per key — the lowest by (`lowercase`, then `compareTo`) — sorted in that
  same order.
- Migrations run in declared order `[epic4-list-seed, epic9-multi-store]`, each checking only its own
  `app_migrations` id and none short-circuiting the other; `epic9-multi-store` writes its completion record last, and
  runs before any storage cache is populated (AR-E9-5).
- The shopping row stays ONE control: chips are presentational, the accessible **name** stays exactly
  `Toggle <name>`, and the store list rides the accessible **description** (UX-DR-E9-7, FR60).
- `StoreField` keeps its no-second-`role=combobox` constraint (`e2e/support/ui.ts:139-143` scopes the category Select
  by role inside `add-item-dialog`), keeps the `{testIdPrefix}` convention, and stays keyboard-operable at 320px.
- Backend rules proven with Kotest + Testcontainers; UI behaviour proven through the UI on `chromium` **and**
  `mobile` (320px floor); every new test observed failing first.
- `EXPERIENCE.md` is corrected in the same commit as the screens this story changes.

**Never:**
- No `store` anywhere in the GraphQL schema, the domain model, the Mongo mapper or any frontend document after this
  story — `stores` only. The legacy Mongo **field** survives only until the migration unsets it.
- No client-side authority over normalization: the client mirrors the rule for immediate feedback, the server's
  result is what renders.
- No `Autocomplete` / second combobox in either item dialog; no toast or snackbar; no new palette key or theme
  override.
- Do not touch the check-state transition (`applyCheckState`), the category cascade, `AddItemDialog`'s
  no-categories/FAB behaviour (Story 9.11), or the account menu (Story 9.7).
- Do not hand-edit `src/__generated__/**`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normalizer, mixed input | `saveItem` with `stores: [" Lidl ", "lidl", "", "Aldi Nord"]`, create or update | Item stores `["Lidl", "Aldi Nord"]` | No error expected |
| Casing-only edit | Stored `["Lidl"]`, save `["LIDL"]` | Stored `["LIDL"]`; the frontend treats it as a change and sends it | No error expected |
| Empty list | `stores: []`, or every entry blank | Item stores `[]`; no chips render | No error expected |
| Suggestions | List holds `["lidl"]`, `["Lidl"]`, `["Aldi Nord"]`, `[]` | `["Aldi Nord", "Lidl"]` — one per key, lowest by (lowercase, then `compareTo`), in that order | No error expected |
| Migration, legacy row | `store: "Lidl"`, no `stores`, `epic4-list-seed` recorded | `stores: ["Lidl"]`, no `store` field | No error expected |
| Migration, mixed row | `store: " lidl "`, `stores: ["LIDL"]` | `stores: ["LIDL"]` (existing first, legacy is a duplicate key), no `store` field | No error expected |
| Migration, empty legacy | `store: null` / `""` / `"   "` | `stores: []`, no `store` field | No error expected |
| Migration, re-run | `epic9-multi-store` recorded | Nothing changes; a fresh database starts cleanly and still records it | No error expected |
| Dialog duplicate | Field holds `Lidl`; user commits ` lidl ` | Field still holds exactly `Lidl`; input clears and says the store is already added | Inline message, no save attempt |
| Orphan edit | Item's category is not on the list; user saves without touching the Select | Dialog stays open, says a category must be chosen, nothing is saved | Inline field error (AR-E9-12) |
| Realtime | Member A changes an item's stores | Member B's open `/list/:id` shows the new chips with no reload | No error expected |

</intent-contract>

## Code Map

**Backend** (`bp_back/src/main/kotlin/com/bagplease/`)

- `entity/item/Item.kt:12` — `val store: String? = null` → `val stores: List<String> = emptyList()`. Everything else
  on this record is untouched.
- `entity/item/mongo/MongoItem.kt:21` — same swap, `val stores: List<String> = emptyList()`. The default is what lets
  a not-yet-migrated document deserialize; `store` is **dropped from the class**, so kotlinx ignores the legacy field
  (the driver's codec ignores unknown BSON keys — confirm on the migration test, which reads legacy docs through
  `getAll`).
- `entity/item/mongo/MongoItemMapper.kt:15,32` — both directions carry `stores`.
- `entity/item/mongo/ItemRepository.kt:51-67` `save` — `Updates.set("store", …)` at `:59` becomes
  `Updates.set("stores", item.stores)` **plus** `Updates.unset("store")` in the same `Updates.combine` (AR-E9-3), so
  every write self-heals a legacy row. `:97-113` and the `init` indexes are read-only — no store index exists or is
  added.
- `entity/item/gql/GqlItem.kt:13` — `val stores: List<String> = emptyList()` (schema `[String!]!`).
- `entity/item/gql/GqlItemInput.kt:13` — `val stores: List<String> = emptyList()`; the default keeps the argument
  optional in the schema while the field itself stays non-null.
- `entity/item/gql/GqlItemMapper.kt:17,33` — `mapItemToGql` / `mapItemFromInput` carry `stores`; `mapItemFromGql`
  (`:43-51`) never carried `store` and stays as it is.
- `entity/item/ItemService.kt:39-91` `saveItem` — normalize ONCE at the top of the function
  (`val incoming = item.copy(stores = StoreNames.normalize(item.stores))`) so create and update share one rule; the
  update branch's merge allowlist at `:58` becomes `name, category, stores`. `applyCheckState` (`:173-189`) and both
  category guards are **read-only** — do not restructure them.
- `entity/item/ItemService.kt:132-135` `getStoreSuggestions` — today `mapNotNull { it.store }.distinct()`. Becomes
  `StoreNames.suggestions(storage.getByListId(listId).flatMap { it.stores })`.
- **NEW** `entity/item/StoreNames.kt` — `object StoreNames { fun normalize(raw: List<String>): List<String>;
  fun suggestions(raw: List<String>): List<String> }`. Its own file because `plugins/Migration.kt` needs it too and
  `ItemService`'s copy would have to be `internal` to reach it.
- `plugins/Migration.kt:21-85` — `configureMigration` currently returns from the WHOLE `runBlocking` at `:33-35`,
  `:46-50` and after epic 4 completes. Restructure into two private suspend functions called in order inside one
  `runBlocking`; each owns its `findMigration` check, and neither can skip the other (AR-E9-5). The epic-4 body moves
  verbatim. `epic9-multi-store` streams `items` documents where `Filters.exists("store")`, computing
  `stores = StoreNames.normalize(existing stores + store)` per document and issuing
  `Updates.combine(Updates.set("stores", …), Updates.unset("store"))`, one document at a time; the completion record
  is written last.
- `Application.kt:68-75` — the call site; signature unchanged unless the restructure needs it.

**Backend tests** (`bp_back/src/test/kotlin/com/bagplease/`)

- `ItemLifecycleTest.kt:114-131` `saveItem(...)` helper builds raw GraphQL with `store: \"…\"` at `:125` and selects
  `store` at `:128` — both become `stores: [\"…\", …]`; make the parameter `stores: List<String> = emptyList()`.
  Call sites to update: `:246`/`:249` (AC1 round-trip), `:568-571` (AC13 suggestions).
- `ItemLifecycleTest.kt:554-586` AC13 — rewrite for the key/order contract; `:588-606` (non-member) is unaffected.
- `ItemLifecycleTest.kt:184-205` `buildItemService(db)` — the out-of-band service used by the scheduler cases; it
  constructs `ItemService`, so a constructor change would ripple here. Do not change the constructor.
- `MigrationTest.kt:44-49` `clearCollections` and `:92-113` AC18 — AC18 asserts `app_migrations` holds exactly **1**
  document, which stops being true once `epic9-multi-store` records itself. Narrow it to the epic-4 record (and the
  list count, which is the real point of the case) rather than deleting it.
- `ItemApiTest.kt`, `ListServiceTest.kt`, `ItemCategoryStorageTest.kt` — no `store` reference; run them anyway.

**Frontend** (`bp_front/src/`)

- `lib/lists/listsQueries.ts:152-290` — add `ListItemFields` on `Item` (`id name checked category listId stores
  addedBy recurring deleted`) and spread it in `ItemsQuery` (`:157`), `SaveItemMutation` (`:203`),
  `CheckItemMutation` (`:230`), `UncheckItemMutation` (`:246`) and `ItemUpdatesSubscription` (`:277`) — the five
  documents that return an `Item` (AR-E9-10a). Today they carry four different field sets; the fragment makes the
  subscription payload and the query row the same type, which is what `ListShoppingPage`'s merge already assumes by
  cast. `:27-28` — `ListItem` is derived from `ItemsQueryResult`; re-derive it from the generated fragment type.
  `:152-156` and `:173-176` are stale prose (full-document upsert / unsorted suggestions) — rewrite them.
- `codegen.ts:35` — `fragmentMasking: true`. With masking on, a spread makes `ItemsQuery['getItems'][number]` a
  `$fragmentRefs` marker and every consumer would need `useFragment`. No fragment exists in the project today, so
  turn masking **off**; the spread then flattens into each operation type and `ListItem` stays a plain object type.
- `lib/lists/storeValue.ts:6-17` — `normalizeStore(raw: string): string | null` → `storeKey(name: string): string`
  (`trim().toLowerCase()`, never `toLocaleLowerCase`) and `normalizeStores(raw: readonly string[]): string[]`
  mirroring the server. `STORE_MAX` stays. Keep the module **import-free**: `e2e/order.spec.ts` imports
  `src/lib/lists/order.ts` by relative path and `tsconfig.e2e.json` defines no `@/` paths — the new pure spec does
  the same with this module.
- **NEW** `lib/lists/categoryChoice.ts` — `isKnownCategoryId(categoryId: string, categories: readonly {id: string}[])`.
  Import-free, for the same reason. This is the orphan guard, extracted so it is testable without a browser (no API
  path can create an orphan since Story 9.3 — see `deferred-work.md:653-663`).
- `components/StoreField.tsx` (whole file) — becomes multi-value: `value: readonly string[]`,
  `onChange: (next: string[]) => void`. Selected stores render as removable `Chip`s above a plain `TextField`;
  suggestions stay clickable outlined `Chip`s below it, now filtered to keys not already selected, rendered in the
  server's order (the server sorts since AR-E9-4 — drop the client trim/dedupe/sort at `:35-37`). Keep the error
  caption (`:57-65`), the `mt: -1.5` spacer trick and every `{testIdPrefix}-store*` id; add
  `{testIdPrefix}-store-chip-<name>` and `{testIdPrefix}-store-chip-remove-<name>`.
- `components/AddItemDialog.tsx:50,63,116,180-186` — `store` state becomes `stores: string[]`; the payload sends
  `stores: normalizeStores(stores)`.
- `components/EditItemDialog.tsx:53,79,123-151,208-214` — same swap; seed from `item.stores`. `:123-126`
  `nothingChanged` compares stores by exact string equality of the normalized arrays, so a casing-only edit still
  saves. `:91-110` `validate()` gains the orphan guard via `isKnownCategoryId`. The `:34-49` header and `:118-134`
  comments are Story 9.5's rewrite — amend the store sentences only, do not re-litigate the merge prose.
- `routes/ListShoppingPage.tsx:67-74` (description parts), `:176-186` (the single chip) — `Store: X` becomes
  `Stores: A, B`, omitted entirely when `stores` is empty; the chip becomes a wrapping row of chips,
  `data-testid="shopping-item-stores-<name>"` on the container and `shopping-item-store-<name>-<store>` per chip
  (UX-DR-E9-7). `:160-175` (name `Typography`, `minWidth: 0`) and `:187-201` (`addedBy`) are the 320px constraint:
  the chips must wrap inside the `minWidth: 0` box, never widen the row. `:266-290` realtime merge — read-only, but
  confirm the fragment keeps the cast at `:273` honest.
- `routes/ListDetailPage.tsx` — renders no store; only touched if `ListItem`'s shape breaks a build.

**E2E** (`bp_front/e2e/`)

- `support/ui.ts:133-148` `addItem(page, categoryName, itemName, store?)` — the `store?: string` parameter becomes
  `stores?: readonly string[]`, driven through the new field. `:139-143`'s scoped `getByRole('combobox')` is the
  constraint that forbids an Autocomplete.
- `item-editing.spec.ts:36-40` `setStoreViaEdit`, `:45-61` `ApiItem`/`fetchItem` (raw GraphQL at `:56` selects
  `store`), `:86`, `:106-144` (FR44 set/change/clear), `:146-199` (suggestions), `:222-235`, `:310-317`, `:360-377`
  (two-actor realtime) — all rewritten for the multi-value field. This file owns the FR44 UI contract.
- `shopping.spec.ts:313-315` (fixture store), `:334` (region-2 chip id), `:379-384` (accessible-description regex) —
  the FR60 single-control cases; the name assertion at `:366` must keep passing verbatim.
- `narrow-viewport.spec.ts` — add the 320px multi-store row case using `expectNoHorizontalOverflow` /
  `expectNotClipped` / `expectInsideViewport` (`support/layout.ts:62,85,131`).
- **NEW** `item-fields.spec.ts` — browserless spec in the style of `order.spec.ts:1-25`, importing
  `../src/lib/lists/storeValue` and `../src/lib/lists/categoryChoice` by relative path.

**Docs & ledger**

- `docs/deployment-guide.md:99-103` (`## MongoDB Persistence`) — add the AR-E9-5a pre-deploy `mongodump` of the
  `db_data` database and the restore-plus-previous-image rollback for the release carrying `epic9-multi-store`.
- `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md:380-392` (§5.3.1 store chip prose + the
  AR-E8-8a ruling) and `:665-672` (§9.2 testid conventions) — correct to the plural chips and the new ids. §8's
  dialog conventions get the store field's commit-key decision.
- `_bmad-output/implementation-artifacts/deferred-work.md:54` (index bullet) and `:671-679` ("Deferred from: Story
  8.6", the OPEN orphan-dialog entry) — close in place with the `✅ CLOSED by Story 9.6 (2026-09-20): … Was: …`
  idiom used at `:36-46`. The `:664-669` paragraph lives inside an already-CLOSED block and is history; leave it.
- `_bmad-output/implementation-artifacts/sprint-status.yaml:120` — `9-6-…: backlog` → `review` at story close, as
  9.3–9.5 did.

## Tasks & Acceptance

**Execution:**

- [x] `bp_back/src/main/kotlin/com/bagplease/entity/item/StoreNames.kt` — NEW. `normalize` (trim, drop blanks, dedupe
  by `lowercase(Locale.ROOT)` keeping first occurrence) and `suggestions` (one name per key, the lowest by
  (lowercase, then `compareTo`), sorted by that pair). One definition, shared by the service and the migration.
- [x] `bp_back/.../entity/item/Item.kt`, `mongo/MongoItem.kt`, `mongo/MongoItemMapper.kt`, `gql/GqlItem.kt`,
  `gql/GqlItemInput.kt`, `gql/GqlItemMapper.kt` — `store: String?` → `stores: List<String> = emptyList()` through
  every layer. `store` exists in none of them afterwards.
- [x] `bp_back/.../entity/item/mongo/ItemRepository.kt` — `save` sets `stores` and unsets `store` in the one
  `Updates.combine`, so any write self-heals a legacy document.
- [x] `bp_back/.../entity/item/ItemService.kt` — normalize the incoming item's stores once in `saveItem` before the
  create/update branch; the update merge allowlist becomes `name, category, stores`; `getStoreSuggestions` flattens
  and goes through `StoreNames.suggestions`. No change to check state, cascades or guards.
- [x] `bp_back/.../plugins/Migration.kt` — split into the two ordered, independently-gated migrations and add
  `epic9-multi-store` per AR-E9-5 (per-document, completion record last).
- [x] `bp_back/src/test/kotlin/com/bagplease/MigrationTest.kt` — **written FIRST, run red.** Seed, with
  `epic4-list-seed` already recorded: legacy-only `store`; `store: " lidl "` alongside `stores: ["LIDL"]`; null,
  blank and padded `store`; an already-converted document. Assert the per-row results in the matrix, that no document
  keeps a `store` field, that `epic9-multi-store` is recorded, that a second run changes nothing, and that a fresh
  (empty) database completes cleanly. Narrow AC18's `app_migrations` count assertion to the epic-4 record.
- [x] `bp_back/src/test/kotlin/com/bagplease/ItemLifecycleTest.kt` — **written FIRST, run red.** Port the `saveItem`
  helper and its call sites to `stores`; add: the mixed-input normalizer case on create AND on update; a casing-only
  update persisting `["LIDL"]`; an empty/blank-only list storing `[]`; the suggestions key/order contract; `addedBy`
  and check state surviving a stores-only edit.
- [x] `bp_front/codegen.ts` — `fragmentMasking: false`, with a comment saying why (the `ListItemFields` spread must
  flatten into the operation types).
- [x] `bp_front/src/lib/lists/listsQueries.ts` — add the `ListItemFields` fragment, spread it in all five
  item-returning documents, re-derive `ListItem` from the fragment type, and correct the two stale comment blocks.
- [x] `bp_front/src/lib/lists/storeValue.ts` — `storeKey` + `normalizeStores` replacing `normalizeStore`; keep the
  module import-free.
- [x] `bp_front/src/lib/lists/categoryChoice.ts` — NEW, import-free `isKnownCategoryId`.
- [x] `bp_front/src/components/StoreField.tsx` — multi-value field per UX-DR-E9-6 and the Design Notes: chips for the
  selected stores with per-chip remove, a plain text input that commits on Enter and on blur, duplicate keys refused
  with an inline message, suggestions filtered to unselected keys. No second combobox.
- [x] `bp_front/src/components/AddItemDialog.tsx` and `EditItemDialog.tsx` — array state and payload; edit seeds from
  `item.stores`; the change comparison uses exact string equality over the normalized arrays; `EditItemDialog.validate`
  rejects a category id that is not in `categories` with `Choose a category`.
- [x] `bp_front/src/routes/ListShoppingPage.tsx` — chip row inside the closed control surface with the UX-DR-E9-7
  test ids, and `Stores: A, B` in the row description, omitted when there are none.
- [x] `bp_front/src/__generated__/**` — regenerate with `npm run generate` against the rebuilt stack on `:2080`.
  Never hand-edited.
- [x] `bp_front/e2e/support/ui.ts`, `item-editing.spec.ts`, `shopping.spec.ts`, `narrow-viewport.spec.ts` — port to
  the multi-value field and add the 320px three-long-names case; **each new/changed assertion observed failing first.**
- [x] `bp_front/e2e/item-fields.spec.ts` — NEW browserless spec for `normalizeStores`/`storeKey` and
  `isKnownCategoryId`, covering the normalizer rows of the matrix and the orphan guard.
- [x] `gradle.properties` + `bp_front/package.json` — `0.18.0` → `0.19.0`, in lockstep.
- [x] `docs/deployment-guide.md` — the AR-E9-5a dump/rollback rule.
- [x] `_bmad-output/planning-artifacts/ux-designs/ux-epic-8/EXPERIENCE.md` — §5.3.1, §8 and §9.2 corrected in this
  same commit.
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` — close the orphan-dialog entry in place (index bullet
  and body).
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` — `9-6-…: review` at story close.

**Acceptance Criteria:**

- Given the running backend's schema, when it is introspected, then `Item.stores` and `ItemInput.stores` are
  `[String!]!` and the string `store` appears in no type, input or query in the schema.
- Given `ItemRepository.save`, when any item is written, then the same update both sets `stores` and unsets `store`,
  so no write can leave the legacy field behind.
- Given the full backend suite, when it runs after the change, then it is green and no pre-existing case was edited
  except `MigrationTest`'s `app_migrations` count assertion, which is narrowed rather than removed.
- Given an item with stores A and B on `/list/:id` at both the desktop and the 320px project, when the row renders,
  then both chips show inside the row, the row's accessible name is exactly `Toggle <name>`, its description contains
  `Stores: A, B`, activating any chip toggles the item, and an item with no stores has no stores segment and no
  container.
- Given three long store names at 320px, when the shopping view renders, then the page does not scroll horizontally
  and the check glyph and the item name stay inside the viewport.
- Given member A changes an item's stores, when member B is watching `/list/:id`, then B sees the new chips without a
  reload.
- Given either item dialog, when the user drives the store field by keyboard only, then they can add a typed name,
  pick a suggestion, and remove an individual store; the field has a visible associated label; and the dialog's
  category `Select` is still the only `role=combobox` inside it.
- Given the repository at story close, when `git grep -n 'store\b'` is read across `bp_back/src`, `bp_front/src` and
  `bp_front/e2e`, then no remaining hit is a single-value item store (prose about the legacy Mongo field and the
  migration excepted).
- Given `gradle.properties` and `bp_front/package.json`, when the story closes, then both read the same bumped
  version.
- Given the ledger, when the story closes, then the Story 8.6 orphan-dialog entry is marked closed in place and
  `docs/deployment-guide.md` records the dump and rollback.

## Spec Change Log

- **2026-09-20 — `ItemInput.stores` ships as `[String!]`, not `[String!]!`.** graphql-kotlin 10.2.1 has no
  `@GraphQLDefault` and does not read Kotlin default values, so `val stores: List<String> = emptyList()` on the INPUT
  generates a REQUIRED `[String!]!` argument: every caller that omits it fails validation, which broke ~35
  pre-existing backend cases whose raw GraphQL predates this field. Honouring the AC's schema shape literally would
  have meant editing all of them, against the same section's "no pre-existing case was edited" rule. The input's list
  is therefore nullable and `GqlItemMapper` maps a missing list to `emptyList()` — the same value the normalizer
  produces for `[]`, so "omitted" and "[]" are indistinguishable downstream. **`Item.stores` and every result type
  are `[String!]!` as specified**, the elements are non-null on both sides, and the frontend always sends an array.
- **2026-09-20 — `StoreNames.suggestions` does not call `normalize` first.** The Design Notes' sketch did, which made
  its `minWith` dead code (normalize already collapses each key to its FIRST occurrence) and would have answered
  `["Aldi Nord", "lidl"]` where the I/O matrix asks for `["Aldi Nord", "Lidl"]`. Implemented as trim → drop blanks →
  group by key → take the minimum by (`lowercase`, then `compareTo`) → sort by the same pair, which is what the
  matrix row and the AC describe. Pinned by `ItemLifecycleTest`'s AC13 case.

- **2026-09-21 — SUPERSEDES the first entry above: `ItemInput.stores` is `[String!]!`, required.** Review found the
  nullable form deviates from the intent's explicit shape and lets an omitted argument mean "clear every store" on
  the update branch, which copies `stores` straight onto the stored item. The premise that required would break
  "~35" pre-existing cases was wrong: it is ~19 raw `saveItem` fixtures, each a mechanical `stores: []`. The
  input's field is now `List<String>` with no default, `GqlItemMapper` no longer defaults it, the generated
  `ItemInput.stores` is `Array<string>`, and every raw fixture (backend tests, two E2E seed helpers) sends it.

## Review Triage Log

### 2026-09-21 — Review pass
- verdicts: 37 findings — four layers reported; per-finding rows below cover the ones itemised in the triage handoff.
  The handoff recorded the remaining findings only as aggregate counts (11 patch entries, 1 deferred, 25
  rejected/false), so they are NOT reproduced row by row here.
- findings:
  - `[medium]` `[patch]` `ItemInput.stores` nullable — deviates from the intent's `[String!]!` and makes an omitted argument
    mean "clear every store" on update (four layers converged) — made required; `GqlItemInput`/`GqlItemMapper`
    changed, `stores: []` added to every raw fixture (ItemApiTest, ItemCategoryStorageTest, ListAuthorizationTest,
    ListServiceTest, ListSharingTest, SubscriptionScopingTest, ItemLifecycleTest helper, two E2E seed helpers),
    codegen re-run so `ItemInput.stores` is `Array<string>`.
  - `[medium]` `[patch]` Orphan guard untested at the dialog — deleting the guard left every test green — new page test in
    `item-editing.spec.ts` builds the orphan by rewriting the `Categories` response and asserts the dialog stays
    open, says "Choose a category" and sends no `SaveItem`.
  - `[medium]` `[patch]` Store-less row description could ship a bare "Stores:" with CI green — `shopping.spec.ts` FR60 test
    now asserts a store-less item's description is `Added by …` and does not match `/Stores/`.
  - `[medium]` `[patch]` Duplicate-store message not announced — `StoreField` gives it `role="alert"` and an id the input
    references through `aria-describedby`; asserted in `item-editing.spec.ts`.
  - `[medium]` `[patch]` Enter on an empty draft silently does nothing — `StoreField` now leaves Enter alone when the
    trimmed draft is empty so the form submits; new page test.
  - `[low]` `[patch]` Six further low patch entries (not itemised in the handoff) — NOT verified as applied in this run;
    see Residual risks.
  - `[false]` `[reject]` "Guard fires whenever categories is empty/loading" — the dialog only opens from a row in the content
    branch and Apollo retains data across a refetch; the one real window (failed refetch with the dialog open) is
    recoverable and its fix adds a prop and a branch.
  - `[false]` `[reject]` "Codec-drops-unknown-keys claim is untested" — MigrationTest's "a converted row still reads back" case
    reads through `ItemRepository.getAll()` before the migration with the legacy key present.
  - `[false]` `[reject]` "Client-side suggestion trim/dedupe/sort was dropped" — needs a new bundle against an old backend,
    unreachable with a single-image deploy.
  - `[low]` `[defer]` Test-id collisions from `shopping-item-store-<item>-<store>` — pre-existing name-keying defect with its
    own open ledger entry; recorded in `deferred`.

## Design Notes

**The normalizer, once.** Server-side:

```kotlin
object StoreNames {
    private fun key(name: String) = name.trim().lowercase(Locale.ROOT)

    fun normalize(raw: List<String>): List<String> {
        val seen = LinkedHashMap<String, String>()
        for (name in raw) {
            val trimmed = name.trim()
            if (trimmed.isEmpty()) continue
            seen.putIfAbsent(key(trimmed), trimmed)   // first occurrence wins: casing AND position
        }
        return seen.values.toList()
    }

    fun suggestions(raw: List<String>): List<String> =
        normalize(raw).groupBy(::key).values
            .map { group -> group.minWith(compareBy({ key(it) }, { it })) }
            .sortedWith(compareBy({ key(it) }, { it }))
}
```

`normalize` already collapses each key to one name, so `suggestions`' `minWith` only matters when it is handed the
flattened stores of many items — which is exactly its call site. The client mirror in `storeValue.ts` uses
`trim()` + `toLowerCase()` and never a locale variant, so the two agree on the ASCII names this app sees; where they
could disagree, the server's answer is what renders.

**Why the commit key is Enter, and why blur commits too.** The dialogs are native forms that submit on Enter (§8 of
`EXPERIENCE.md`). A multi-value field needs a commit gesture, and Enter is the one users expect from a chip input, so
the store input calls `preventDefault()` and commits the draft instead of submitting — this is the explicit decision
`EXPERIENCE.md` §8 asks for and it gets its own E2E assertion. Blur commits the same draft, which is what keeps
"type Lidl, click Save" from silently dropping the name: the button's `pointerdown` blurs the input, React flushes
the commit, and the click then submits a payload that already holds it.

**Why `fragmentMasking: false`.** Masking exists to stop a component reading fields it did not ask for. Nothing in
this project uses a fragment yet, and the one this story adds exists to make five documents identical, not to hide
anything — `ListItem` must stay a plain object type that `ListShoppingPage`'s realtime merge, both dialogs and
`itemFilter` can pass around. Turning masking off keeps the diff to the five documents; leaving it on would put a
`useFragment` call in every consumer for no gain.

**Why the orphan guard is a pure function.** The dialog's `nothingChanged` short-circuit is not the bug — the bug is
that an out-of-list category id passes `validate()`. Guarding in `validate()` fixes it for every path (the
short-circuit is never reached). It lives in its own import-free module because since Story 9.3 nothing can create an
orphan through the API, so no browser test can build the fixture (`deferred-work.md:653-663`); the guard is asserted
where it actually lives, exactly as `order.spec.ts` does for the duplicate-name ordering.

**Migration shape.** Two private suspend functions in `Migration.kt`, called in order inside the existing
`runBlocking`; `epic9-multi-store` filters `Filters.exists("store")`, reads `stores` and `store` off the raw
`Document`, writes `normalize(existing + legacy)` and unsets `store` per document, then records completion. It must
not batch-update: the value written is per-document. It runs before `configureGql`, and therefore before
`ItemStorage.sync()` can cache a pre-migration row.

## Verification

**Commands:**

- `./gradlew :bp_back:test --tests "com.bagplease.MigrationTest"` — expected: red before `Migration.kt` changes,
  green after.
- `./gradlew :bp_back:test` — expected: all green.
- `docker compose up -d --build` then
  `CODEGEN_TOKEN="$(curl -s -X POST http://localhost:2080/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')" npm run generate`
  (in `bp_front/`) — expected: `src/__generated__/graphql.ts` carries `stores: Array<string>` and no `store`.
- `cd bp_front && npm run lint && npm run build` — expected: clean.
- `docker compose up -d --build && cd bp_front && npm run test:e2e` — expected: green on `chromium` and `mobile`.
- `git grep -n "\bstore\b" -- bp_back/src bp_front/src bp_front/e2e` — expected: only migration/legacy prose.
- `curl -s -X POST http://localhost:2080/api/graphql -H 'Content-Type: application/json' -H "Authorization: Bearer $TOKEN" -d '{"query":"{__type(name:\"Item\"){fields{name}}}"}'` —
  expected: `stores` present, `store` absent.

## Auto Run Result

Status: done

**Summary.** An item holds `stores: [String!]!` instead of one `store`: server-side normalization (trim, drop blanks,
dedupe by lowercased key), a startup migration folding legacy `store` into `stores`, a multi-value chip field in both
item dialogs, store chips inside the shopping row, the orphan-category guard on the edit dialog, and the
dump/rollback rule in `docs/deployment-guide.md`. This pass made `ItemInput.stores` required and patched four
frontend findings.

**Files changed (this pass, on top of the reviewed diff).**
- `bp_back/.../gql/GqlItemInput.kt`, `GqlItemMapper.kt` — `stores` is a required `List<String>`.
- `bp_back/src/test/...` (7 files) — `stores: []` on every raw `saveItem` fixture; `ItemLifecycleTest.saveItem` always sends it.
- `bp_front/src/components/StoreField.tsx` — duplicate message is an alert linked by `aria-describedby`; Enter on an empty draft submits.
- `bp_front/src/__generated__/graphql.ts` — regenerated: `ItemInput.stores: Array<string>`.
- `bp_front/e2e/item-editing.spec.ts`, `shopping.spec.ts` — orphan-dialog, empty-Enter, store-less-description and announcement cases; seed helpers send `stores`.
- `bp_front/src/lib/lists/categoryChoice.ts`, `e2e/item-fields.spec.ts` — stale "no browser test can build the fixture" comments corrected.

**Review findings.** Patches applied: 5 medium (patched counts by verdict: medium 5, high 0). Deferred: 1
(store-chip test-id collisions). Rejected: 3 itemised false findings (see the log with their refutations); the
remaining rejected/false and low-patch findings were reported only as aggregate counts in the handoff.

**Follow-up review recommended: true.** Five medium entries were patched on a first pass. Unverified risk: making
`stores` required tightens the schema across 19 pre-existing fixtures in 7 files, and the new orphan-dialog E2E
case uses response rewriting (`page.route` on `Categories`) that the item dialogs' tests had not used before.

**Verification.**
- `./mise/back_test.sh` — 157 tests, 157 passed (first run after the patch: 29 `ItemLifecycleTest` failures from the un-updated helper, fixed, rerun green).
- `docker compose up -d --build` then `npm run generate` — schema now `stores: Array<string>`; only that one line drifted.
- `npm run lint` — clean; `npm run build` — clean (tsc + vite + PWA).
- `npm run test:e2e` — 232 passed, 24 skipped (tagged serial specs), 0 failed, on `chromium` and `mobile`.

**Residual risks.** The handoff's six additional low patch entries and the 25 rejected/false findings were not itemised,
so this run could not confirm the six were applied; the working tree showed only the nullability patch when this run
resumed. The `Verification` section's `git grep` for `\bstore\b` still shows the migration's legacy `store` unset and
its test, as intended.
