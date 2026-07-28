---
title: 'Story 5.7 — Sharing & Membership'
type: 'feature'
created: '2026-07-23'
status: 'done'
baseline_revision: '94607d6dcee3d80c468831d2bd848007c9c19526'
final_revision: '15249de4d6b25b2bbd6a61ff8b723506576e8f90'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-5-6-list-view-shopping-realtime.md'
warnings: [oversized]
---

<intent-contract>

## Intent

**Problem:** Users can manage (5.5) and shop (5.6) their own lists, but there is no way to collaborate: no UI to share a list, accept/decline an invite, see co-members, remove a member, or leave a shared list. The backend sharing contract (`shareList`, `acceptInvite`, `rejectInvite`, `removeMember`, `leaveList`, and `lists.pendingInvites` / `List.members`) is fully implemented and frozen, but the frontend selects none of it.

**Approach:** On the existing `/lists` page, add a **Pending Invites** section (accept / decline) and per-list membership affordances: owners get a **Share & Members** dialog (invite by exact username, view members, remove a member); non-owner members get a **Leave** action. Extend the `Lists` query to select `members` and `pendingInvites`; add the five membership mutations; refetch `Lists` after each (no membership subscription exists). Backend consumed as-is.

## Boundaries & Constraints

**Always:**
- Consume the frozen backend contract as-is; author operations in `src/lib/lists/listsQueries.ts` with `graphql()` from `@/__generated__`, derive types from `@/__generated__/graphql`, then `npm run generate`. Single Apollo client; `useQuery`/`useMutation` from `@apollo/client/react`.
- **Extend the existing `Lists` query** (do not add a second lists query): also select `lists { … members { userId username status } }` and the sibling `pendingInvites { listId listName listEmoji ownerUsername }` (both are currently omitted with a "Story 5.7" comment). `ListSummary` widens automatically; consumers (`ListDetailPage`, `HomeRedirect`, `ListShoppingPage` switcher) must still compile.
- **No membership real-time.** The backend emits **no** subscription event on any membership change. After every membership mutation, update the caller's view from the mutation's returned `List` where available AND refetch the `Lists` query (`refetchQueries`/`refetch`) so the invites/members sections re-render. The invitee sees a new invite only on their **next `/lists` load or refetch** — never poll and never add a members subscription.
- Owner determination is inline `list.ownerUsername === username` (`username` from `useAuth()`), matching existing convention. The `List.members` array **excludes the owner** — render the owner explicitly (label "Owner", not removable).
- Errors shown inline via MUI `<Alert>` using `graphqlErrorMessage` (`@/lib/admin/adminErrors`), never toasts. All sharing errors carry `extensions.code = FORBIDDEN`; the differentiating signal is the **message string** — surface the exact backend message; do not invent codes or map to generic "not authorized".
- Destructive actions (**remove member**, **leave list**) go behind a confirmation reusing `ConfirmDialog`. Form input (the Share dialog) follows `CreateListDialog` conventions: submit-time validation, `disabled={loading}` inputs, submit spinner, same-tick re-entry guard, inline `<Alert role="alert">`.
- Styling via MUI theme + `sx` only; one default export per file; PascalCase; no `console.log` in components; `@/` imports.
- Every scenario ships a **UI-driven** (no API shortcut for the asserted sharing behavior), FR-mapped Playwright E2E, manually exercised in a real browser first, green on `chromium` + `mobile`. Register fresh unique users per run/project (`uniqueUsername(label, projectName)`); use **two browser contexts** for owner/invitee flows; assert only on self-created data.

**Block If:**
- Any change to `bp_back/` is required to satisfy a criterion. Backend is frozen — HALT with status `blocked` and surface the needed change for `md`.

**Never:**
- No new backend mutations/fields; no changes to `AuthContext`, `RouteGuard`, `AdminGuard`, or the token model.
- No membership subscription/polling (backend emits none on membership change).
- No item/category CRUD changes (owned by 5.5/5.6); no one-timer (FR42)/recurring (FR43) UI.
- Do not alter `ListShoppingPage`'s existing FORBIDDEN→`/lists` redirect (already satisfies FR41) beyond what the widened type forces, and do not remove the existing admin graceful-notice on `/lists` (the `lists` FORBIDDEN → `lists-notice` Alert already surfaces FR56).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Owner shares by username | owner opens Share dialog, enters an existing other user's name, submits | `shareList(listId, username)`; user appears in the members list with status `PENDING`; input clears; no error | — |
| Share unknown user | username not in system | inline `<Alert>`: `User '<name>' not found`; no membership change | message shown verbatim |
| Share self | owner enters own username | inline `<Alert>`: `You cannot share a list with yourself` | verbatim |
| Share already-invited / already-member | target has PENDING invite / is ACCEPTED | inline `<Alert>`: `User '<name>' already has a pending invite` / `… is already a member` | verbatim |
| Invitee sees & accepts | invitee loads `/lists` with a PENDING invite | Pending-Invites section shows `{emoji} {listName}` + "Invited by {ownerUsername}"; Accept → `acceptInvite(listId)`, invite row disappears, list now appears in their lists and is accessible | accept error → inline Alert |
| Invitee declines | invitee clicks Decline on a pending invite | `rejectInvite(listId)` (returns Boolean) → invite disappears; list stays inaccessible (no lists row) | decline error → inline Alert |
| Owner removes member | owner opens Share & Members, clicks Remove on a member, confirms | `removeMember(listId, username)`; member removed from the dialog; removed user loses access (their next `/list/:id` load redirects) and their items remain | remove error → inline Alert in confirm dialog |
| Non-owner leaves | member clicks Leave on a shared list row, confirms | `leaveList(listId)` (returns Boolean) → list disappears from their lists; owner/other members keep it | leave error → inline Alert |
| Admin on `/lists` | admin navigates to `/lists` | `lists` query returns FORBIDDEN → graceful `lists-notice` Alert; no list rows, no share/leave/invite affordances render | existing behavior — must not regress (FR56) |
| Removed/declined user deep-links | removed or never-accepted user opens `/list/:id` | `getItems` FORBIDDEN → `<Navigate to="/lists" replace>` (5.6 behavior, reaffirmed) | as 5.6 |

</intent-contract>

## Code Map

- `bp_front/src/lib/lists/listsQueries.ts` -- **extend** `Lists` query: add `members { userId username status }` inside `lists {…}` and add the sibling `pendingInvites { listId listName listEmoji ownerUsername }` (remove the "out of scope / 5.7" comment). **Add** mutations: `ShareList($listId: ID!, $username: String!)` → `shareList { id members { userId username status } }`; `AcceptInvite($listId: ID!)` → `acceptInvite { id }`; `RejectInvite($listId: ID!)` → `rejectInvite`; `RemoveMember($listId: ID!, $username: String!)` → `removeMember { id members { userId username status } }`; `LeaveList($listId: ID!)` → `leaveList`. Export `ListMember` and `PendingInviteSummary` derived types.
- `bp_front/src/__generated__/**` -- regenerate via `CODEGEN_TOKEN=… npm run generate` immediately after; commit, never hand-edit.
- `bp_front/src/routes/ListsPage.tsx` -- render a `<PendingInvites>` block above the lists `<Paper>` (from `data.lists.pendingInvites`); per-row `secondaryAction`: **owner** → a "Share & members" `IconButton` (`manage-members-${name}`, opens `ShareMembersDialog`) alongside the existing `delete-list-button`; **non-owner member** → a "Leave" `IconButton` (`leave-list-${name}`, opens a leave `ConfirmDialog` → `LeaveList`). Wire `refetch` into every dialog's success callback. Keep all existing 5.5/5.6 testids and behavior.
- `bp_front/src/components/ShareMembersDialog.tsx` -- **new** (owner-only). Props `{list, open, onClose, onChanged}`. Shows the owner row ("Owner") + each `list.members` entry with a status indicator (`PENDING` → a "Pending" `Chip`; `ACCEPTED` → active) and a Remove affordance per member (behind a nested `ConfirmDialog`). A username `TextField` + Share button runs `ShareList`. Inline `<Alert>` via `graphqlErrorMessage`. On any success → `onChanged()` (parent `refetch`).
- `bp_front/src/components/PendingInvites.tsx` -- **new**. Props `{invites, onChanged}`. Renders nothing when empty. One row per invite with Accept (`AcceptInvite`) / Decline (`RejectInvite`); on success → `onChanged()`.
- `bp_front/src/components/ConfirmDialog.tsx` -- **reuse as-is** for remove-member and leave-list confirmations (async `onConfirm` throwing → inline Alert, dialog stays open).
- `bp_front/src/lib/admin/adminErrors.ts` -- **reuse** `graphqlErrorMessage` / `isForbiddenError`; no change.
- `bp_front/src/routes/ListShoppingPage.tsx`, `bp_front/src/routes/ListDetailPage.tsx`, `bp_front/src/routes/HomeRedirect.tsx` -- reference only; confirm they still compile after `ListSummary` widens (no behavioral change).
- `bp_front/e2e/sharing.spec.ts` -- **new** UI-driven, FR-mapped scenarios (chromium+mobile).
- `bp_front/e2e/lists.spec.ts` -- resolve the deferred note at ~lines 196-199 ("member-but-not-owner list view … Story 5.7"): assert the owner sees the manage-members affordance and no leave; a member sees leave and no delete/manage. Copy the local helpers (`registerViaUi`, `uniqueUsername`) as the other specs do.

## Tasks & Acceptance

**Execution:**
- [x] `bp_front/src/lib/lists/listsQueries.ts` -- extend `Lists` (`members { userId username status }` + `pendingInvites { listId listName listEmoji ownerUsername }`); add `ShareList`, `AcceptInvite`, `RejectInvite`, `RemoveMember`, `LeaveList` mutations; export `ListMember`/`PendingInviteSummary` types. -- FR39/FR55.
- [x] `bp_front/src/__generated__/**` -- regenerate immediately (components import these types); commit, never hand-edit. -- typed docs incl. new mutations.
- [x] `bp_front/src/components/PendingInvites.tsx` -- **new** section (root `pending-invites-section`, hidden when no invites): per invite (`pending-invite-${listName}`) show `{emoji} {listName}` + "Invited by {ownerUsername}", `accept-invite-${listName}` (`AcceptInvite`) and `decline-invite-${listName}` (`RejectInvite`); inline error; call `onChanged` on success. -- FR39/FR50.
- [x] `bp_front/src/components/ShareMembersDialog.tsx` -- **new** owner dialog (root `share-members-dialog`): username `share-username-input` + `share-submit` (`ShareList`, clear input on success), `share-error` inline Alert; members list = owner ("Owner", no remove) + each `members` entry `member-row-${username}` with status chip and `remove-member-${username}` (`RemoveMember` behind a `ConfirmDialog testId="remove-member-dialog"`); `onChanged` on success. -- FR39/FR40/FR48.
- [x] `bp_front/src/routes/ListsPage.tsx` -- render `<PendingInvites>` above the lists block; add owner `manage-members-${name}` IconButton (opens `ShareMembersDialog`) + keep `delete-list-button`; add non-owner `leave-list-${name}` IconButton (opens leave `ConfirmDialog testId="leave-list-dialog"` → `LeaveList`); pass `refetch` to all success callbacks; preserve existing testids/states. -- FR55/FR56 (affordance gating).
- [x] `bp_front/e2e/sharing.spec.ts` -- **new** two-context, UI-driven scenarios (chromium+mobile): (a) owner shares with user B → B (2nd context) reloads `/lists`, sees the invite, accepts, opens the list and adds an item (peer write, no FORBIDDEN); (b) share errors: unknown user, self, duplicate (exact messages); (c) owner removes B → B's next `/list/:id` load redirects to `/lists`; (d) member leaves → list gone from B's `/lists`; (e) decline → invite gone + list inaccessible; (f) admin at `/lists` → graceful `lists-notice`, no affordances. -- FR39/FR41/FR48/FR55/FR56 verification.
- [x] `bp_front/e2e/lists.spec.ts` -- implement the deferred role-affordance assertion (owner: manage-members visible, leave absent; member: leave visible, delete/manage absent); keep suite green. -- regression guard.

**Acceptance Criteria:**
- Given an owner on `/lists`, when they open a list's Share & Members dialog, enter an existing other user's username, and submit, then that user appears as a `PENDING` member and no error is shown. (FR39)
- Given a user with a pending invite, when they load `/lists`, then a pending-invites section shows the invite with Accept/Decline; accepting makes the list appear in their lists and grants access; declining removes the invite and grants no access. (FR39/FR41/FR50)
- Given a share attempt with an unknown username, oneself, or an already-invited/member user, then the exact backend message is shown inline and no membership change occurs. (FR39)
- Given an owner viewing members, when they remove a member, then that user loses list access (their next list load redirects to `/lists`) and their previously added items remain. (FR40/FR48)
- Given a non-owner member on `/lists`, when they leave a shared list, then it disappears from their lists and they lose access while the owner and other members keep it. (FR55)
- Given the admin, when they navigate to `/lists`, then the graceful FORBIDDEN notice shows and no share/member/leave/invite affordances render. (FR56)
- Given `npm run build`, `npm run lint`, and `npm run test:e2e`, then all pass (E2E green on chromium + mobile; existing specs updated, no regressions).

## Spec Change Log

_Empty — no bad_spec loopback yet._

## Review Triage Log

### 2026-07-23 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6: (high 0, medium 0, low 6)
- defer: 1
- reject: 10
- addressed_findings:
  - `[low]` `[patch]` FR56 admin E2E asserted only the notice + absent invites-section; strengthened it to also assert no `delete-list-button` / `manage-members-*` / `leave-list-*` affordances leak to the admin.
  - `[low]` `[patch]` `PendingInvites` disabled every Accept/Decline in the section during any in-flight op (contradicting its own comment); changed to disable only the busy row's two buttons (`busyListId === invite.listId`), re-entry still guarded by `run`.
  - `[low]` `[patch]` `PendingInvites` reserved only `pr: 12` for a two-button `secondaryAction`; a long list name could run under the buttons on the mobile gate — bumped to `pr: 20`.
  - `[low]` `[patch, test]` No E2E covered the distinct `is already a member` share error (only the pending-duplicate case); added a re-share-after-accept assertion in the remove-member test.
  - `[low]` `[patch]` Owner manage-button `aria-label` was `Share {name}`, understating its scope; changed to `Share and manage members of {name}`.
  - `[low]` `[patch]` The owner row's fixed testid `member-row-owner` collided with `member-row-${username}` for a user literally named "owner"; renamed to `member-owner-row`.
- rejected (noteworthy): conditional-mount makes the dialog's `prevOpen` reset dead code / no exit animation (functionally correct — fresh mount reseeds state each open); local `members` mirror can diverge from a refetched prop (blocked by the modal today, no current-user consequence); two owner icons crowding a truncated name (name already `maxWidth`-truncated, MUI manages spacing); peer-write not re-verified on the owner's screen (cross-member propagation is Story-5.6 real-time; the item appearing proves the non-FORBIDDEN write persisted); duplicate-name testids (pre-existing 5.5/5.6 convention, not user-facing, E2E uses unique names, React keys use ids); `if (data?.shareList.members)` no-op guard (`members` is non-null; harmless); non-PENDING/ACCEPTED status mislabeled (backend `members` only ever carries those two — DECLINED is filtered out); rapid double-click on accept/decline/share/remove/leave (guarded by `run`/`if (sharing)`/ConfirmDialog's own loading); remove/leave mutation rejection "unhandled" (ConfirmDialog wraps `onConfirm` in try/catch → inline Alert, dialog stays open).

## Design Notes

- **Frozen backend contract (quick-ref).** Query `lists → ListsResult { lists: [List!]!, pendingInvites: [PendingInvite!]! }`. `List { id name emoji ownerId ownerUsername members: [ListMember!]! createdAt uncheckedItemCount }`; **`members` excludes the owner** and contains only invitees with `status` `"PENDING"` or `"ACCEPTED"` (`"DECLINED"` filtered out). `ListMember { userId username status }`. `PendingInvite { listId listName listEmoji ownerUsername }`. Mutations: `shareList(listId: ID!, username: String!): List!`, `acceptInvite(listId: ID!): List!`, `rejectInvite(listId: ID!): Boolean!`, `removeMember(listId: ID!, username: String!): List!`, `leaveList(listId: ID!): Boolean!`. (Decline is **`rejectInvite`**, not `declineInvite`.)
- **Exact error messages** (all `extensions.code = FORBIDDEN` — branch on the string): `User '<name>' not found` · `User '<name>' is already a member` · `User '<name>' already has a pending invite` · `You cannot share a list with yourself` · `Access denied: only the list owner can perform this action` · `Admin cannot access list resources` · `List owner cannot leave — delete the list instead` · `List owner cannot be removed — delete the list instead`. Surface `graphqlErrorMessage(err)` (strips the graphql-kotlin `Exception while fetching data (…):` prefix) verbatim.
- **No membership real-time — refetch, don't subscribe.** `ListService` emits nothing on membership change and there is no List subscription. So: (1) the acting user's dialog updates from the mutation's returned `List.members` where present and triggers a parent `Lists` refetch; (2) the *other* party only sees the change on their next `/lists` load/refetch. In E2E this means: after the owner shares, the invitee context must **navigate to / reload `/lists`** to see the invite — do not `waitFor` a live update.
- **`rejectInvite` / `leaveList` return `Boolean`** (not `List`); update the UI purely by refetching `Lists`. `shareList` / `removeMember` return the updated `List` — use its `members` for immediate dialog state, still refetch `Lists` for the row.
- **Remove revokes pending too.** `removeMember` hard-deletes the `list_members` row regardless of `PENDING`/`ACCEPTED`, so the owner's Remove affordance works on both a pending invitee (revoke) and an accepted member. Owner is never in `members`, so no self-remove path exists (guarded by `CannotRemoveOwner` anyway).
- **Affordance gating.** Owner (`ownerUsername === username`): Share & Members + Delete, no Leave. Non-owner member: Leave only. Admin: reaches `/lists` (route is auth-guarded, not admin-guarded) but the `lists` query is FORBIDDEN, so no list rows render → no affordances appear and the existing `lists-notice` Alert covers FR56; assert this, don't build new admin handling.
- **Members display / avatars.** No `BPAvatar` exists; reuse the inline `<Avatar sx={{width:24,height:24}}>{username.charAt(0).toUpperCase()}</Avatar>` idiom already used in `AppShell`/`ListShoppingPage`. A `PENDING` member gets a small "Pending" `Chip`.
- **E2E harness.** Helpers (`registerViaUi`, `uniqueUsername`, and the `loginApi`/`gql` API helpers) are copied per-spec (no shared module) — mirror `shopping.spec.ts`. The two-context structure (owner on `page`, invitee via `browser.newContext({baseURL, ignoreHTTPSErrors:true})`) is retained, but unlike 5.6 the sharing itself is now driven through the UI (owner's Share dialog + invitee's Accept), not `shareList`/`acceptInvite` API calls. `global-setup.ts` already enables registration.

## Verification

**Commands:**
- `cd bp_front && CODEGEN_TOKEN="$(curl -s -X POST http://localhost:2080/api/auth/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')" npm run generate` -- expected: `graphql.ts` gains `Lists` (with `members` + `pendingInvites`), `ShareList`, `AcceptInvite`, `RejectInvite`, `RemoveMember`, `LeaveList`; no hand-edits.
- `cd bp_front && npm run build` -- expected: `tsc -b && vite build` clean (widened `ListSummary` compiles everywhere).
- `cd bp_front && npm run lint` -- expected: eslint clean.
- `cd bp_front && npm run test:e2e` -- expected: `sharing.spec.ts` green on chromium + mobile; updated `lists.spec.ts` green; no regressions (the pre-existing `auth.spec` shared registration-flag flake is CI-retry-healed, not a 5.7 regression).

**Manual checks:**
- On `:2080` before writing the E2E (reframe rule 1): as user A, create a list; open Share & Members; share with user B (verify B appears Pending); try unknown user, self, and duplicate (verify exact inline messages). As user B (second browser), reload `/lists`, see the invite, Accept → the list appears and B can add an item; then as A, Remove B → confirm B's `/list/:id` redirects to `/lists`. Re-share + as B Decline → invite gone, no access. Share to a third user C, accept, then as C Leave the list → gone for C, still present for A. Finally, log in as `admin`, navigate to `/lists`, confirm the graceful notice and absence of any share/leave/invite affordance.

## Auto Run Result

Status: **done**

### Summary
Delivered Story 5.7 (Sharing & Membership) on the Epic-5 reframe frontend (backend untouched). Extended the `Lists` query to select `members { userId username status }` and the sibling `pendingInvites`, and added the five membership mutations (`ShareList`, `AcceptInvite`, `RejectInvite`, `RemoveMember`, `LeaveList`). On `/lists`: a **Pending Invites** section (Accept/Decline), an owner-only **Share & Members** dialog (invite by exact username, view owner + members with a Pending chip, remove a member behind a confirm), and a non-owner **Leave** affordance behind a confirm. All sharing errors surface inline verbatim (FORBIDDEN, branched on message). Membership has no real-time channel, so every membership mutation refetches `Lists` and an invitee sees a new invite on their next `/lists` load. Admin remains gracefully blocked from `/lists` (existing FORBIDDEN notice, no affordances).

### Files changed
**Added:** `bp_front/src/components/PendingInvites.tsx`, `bp_front/src/components/ShareMembersDialog.tsx`, `bp_front/e2e/sharing.spec.ts` (6 scenarios × chromium+mobile).
**Modified:** `bp_front/src/lib/lists/listsQueries.ts` (widened `Lists` + 5 mutations + `ListMember`/`PendingInviteSummary` types), `bp_front/src/__generated__/{gql,graphql}.ts` (regenerated), `bp_front/src/routes/ListsPage.tsx` (invites section + per-row owner manage / non-owner leave affordances + refetch wiring), `bp_front/e2e/lists.spec.ts` (resolved the deferred role-affordance assertion + a new member-role test).

### Review findings
- **Patches (6, all low):** strengthened FR56 admin E2E (assert no affordances leak); `PendingInvites` per-row button disable (was section-wide); `PendingInvites` mobile action padding `pr:12`→`pr:20`; added the `is already a member` share-error E2E; more descriptive manage-button `aria-label`; renamed the owner row testid to avoid a `member-row-owner` collision. **Deferred:** 1 (membership-mutation failure doesn't refetch → stale row/invite on a concurrent-removal race; recoverable by reload). **Rejected:** 10 (verified noise or out-of-scope: dead reset code, latent-only divergence, cosmetic crowding, real-time propagation belonging to 5.6, pre-existing name-keyed testid convention, no-op guard, contract-guaranteed status set, guarded double-clicks, ConfirmDialog-handled rejections).

### Verification
- `npm run generate`: `graphql.ts` gained the widened `Lists` + all five mutations; `codegen.ts` pristine; `src/__generated__/` only via codegen (git-verified). `bp_back/` untouched (git-verified).
- `npm run build` + `npm run lint`: clean.
- E2E: **64 tests** (6 sharing + updated lists + existing, × chromium+mobile). Full suite under `--retries=2`: 63 passed, 1 flaky (pre-existing shared registration-flag race in `lists.spec`, retry-healed — not a 5.7 regression). The 24 sharing+lists tests pass with zero retries after the review patches.

### Residual risks
- **No membership real-time (by design):** the other party sees a share/removal/leave only on their next `/lists` load or subscription-driven item event; a mid-session removed member keeps a stale list row/subscription until their next list-data access (the backend `takeWhile` terminates their item subscription on the next event). Deferred: membership mutation failures don't refetch, so a rare concurrent-removal race can leave a stale row until reload.
- **`ShareMembersDialog` local `members` mirror** is authoritative only while the modal is open (which blocks other refetch paths today); if a non-modal refresh path is added later it must re-seed from `list.members`.
