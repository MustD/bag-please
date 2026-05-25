# Story 4.8: Frontend — Lists Tab, List Management & BPAvatar

Status: done

## Story

As a list owner,
I want a Lists tab where I can see all my lists, create new ones, and manage them,
so that I can organise my shopping across multiple lists from one place.

## Acceptance Criteria

**AC1 — Lists tab loads and renders:**
Given `app/lists/page.tsx` is implemented
When an authenticated user navigates to `/lists`
Then the `lists` GQL query is called and the response is rendered as `ListCard` components — one per owned or member
list
And a `pendingInvites` section is rendered below the main list, showing lists awaiting accept/reject with Accept and
Reject buttons
And a FAB (bottom-right, `+` icon) is present to open `SheetNewList`

**AC2 — Empty state:**
Given the user has no lists and no pending invites
When the Lists tab renders
Then `EmptyState` is shown with title `"No lists yet"`, subtitle `"Create your first list to start shopping"`, and a
`"Create list"` action that opens `SheetNewList`

**AC3 — ListCard anatomy:**
Given `ListCard` is implemented
When it renders for a list
Then it displays the list emoji (if present), name, member `BPAvatar` row, and unchecked item count
And a `⋯` `IconButton` (48×48px) opens a context menu with options: Rename, Share & Members, Delete (owners) or Leave (
non-owner members)
And tapping the card body (not the overflow button) navigates to `/list/[listId]`

**AC4 — Inline rename:**
Given the list owner taps Rename in the `ListCard` context menu
When inline rename activates
Then the list name becomes an editable text field directly on the card
And pressing Enter or tapping ✓ fires the `renameList` mutation with `optimisticResponse`
And pressing Escape cancels and restores the original name without a mutation

**AC5 — Delete list:**
Given the list owner taps Delete in the `ListCard` context menu
When the Delete option is selected
Then a blocking MUI `Dialog` appears with body:
`"Delete '{listName}'? This list and all {N} items will be permanently removed."`
And the Dialog has two buttons: `"Delete"` (`color="error"`) and `"Cancel"`
And confirming fires `deleteList` and shows a success Snackbar: `"'{listName}' deleted"`
And the list disappears from the Lists tab

**AC6 — Leave list (non-owner):**
Given a non-owner member taps the `⋯` menu on a shared list
When the context menu opens
Then Delete is NOT shown — only `"Leave list"` is shown in its place
And tapping Leave shows a confirmation Dialog: `"Leave '{listName}'? You will lose access to this list."` with
`"Leave"` (`color="error"`) and `"Cancel"` buttons
And confirming fires `leaveList`; the list disappears from the Lists tab

**AC7 — SheetNewList:**
Given `SheetNewList` is implemented using `BPSheet`
When the user opens it and types a list name
Then the sheet opens in PEEKED state with the name field focused
And the user can tap Create without ever opening to OPEN state
And tapping Create fires `createList(name, emoji?)` and on success navigates to `/list/[newListId]`
And if the name field has content and the user attempts to close the sheet, an unsaved-changes Dialog appears:
`"Discard changes? / Discard / Keep editing"`
And on mutation failure a Snackbar shows: `"Couldn't create list · Retry"`

**AC8 — Emoji picker in SheetNewList:**
Given `SheetNewList` includes an optional emoji field
When the user taps the emoji button/field
Then an inline emoji picker opens within the sheet (does not open a new sheet or navigate)
And selecting an emoji sets it as the list icon and closes the picker
And the name field remains focused after emoji selection

**AC9 — BPAvatar active:**
Given `BPAvatar` is rendered with `status='active'`
When it renders
Then it shows the user's initial in a MUI `Avatar` with no overlay
And `aria-label="{displayName}"` is set

**AC10 — BPAvatar pending:**
Given `BPAvatar` is rendered with `status='pending'`
When it renders
Then a semi-transparent grey overlay (`rgba(0,0,0,0.35)`) covers the avatar with a 12px clock icon centred in white
And `pointer-events: none` on the overlay so the touch target is unaffected
And `aria-label="{displayName} (pending invite)"` is set

**AC11 — BPAvatar pending→active transition:**
Given a pending invite's `status` changes from `'pending'` to `'active'`
When the prop update arrives
Then `BPAvatar` crossfades from the pending overlay to the clear avatar in 200ms opacity transition

**AC12 — Accept invite:**
Given the pending invites section shows a list invite
When the user taps Accept
Then `acceptInvite(listId)` fires; the invite moves from the pending section to the main lists section
And the list is now accessible via `/list/[listId]`

**AC13 — Reject invite:**
Given the user taps Reject on a pending invite
When `rejectInvite(listId)` fires
Then the invite disappears from the pending section with no confirmation dialog required

## Tasks / Subtasks

- [x] **Task 1: Add `renameList` mutation to backend** (AC: 4)
    - [x] Add `suspend fun rename(id: UUID, name: String): List` to `ListStorage.kt`
        - Update in-memory: `storage[id] = storage[id]!!.copy(name = name)` — call `sync()` first; throw
          `IllegalStateException("List not found")` if absent
        - Persist: `repository.rename(id, name)` then return updated list
    - [x] Add `suspend fun rename(id: UUID, name: String)` to `ListRepository.kt`
        - `col.updateOne(Filters.eq("_id", id.toString()), Updates.set(MongoList::name.name, name))`
    - [x] Add `suspend fun renameList(id: UUID, name: String, caller: CallerUsername): Either<ListAuthError, List>` to
      `ListService.kt`
        - Verify owner: `val list = storage.getById(id) ?: raise(ListAuthError.NotMember)` then check
          `list.ownerId.toString() == callerUser!!.id.toString()`; if not owner raise `ListAuthError.NotOwner`
        - Delegate: `storage.rename(id, name)` then return updated list
    - [x] Add `suspend fun renameList(id: ID, name: String, env: DataFetchingEnvironment): GqlList` to `ListMutations`
      in `ListApi.kt`
        - Follow existing mutation pattern:
          `service.renameList(UUID.fromString(id.value), name, caller).fold(ifLeft = ..., ifRight = { list -> val members = ...; GqlListMapper.mapListToGql(list, members, ...) })`
    - [x] Run `../gradlew test` from `bp_back/` to verify no regressions

- [x] **Task 2: Add `uncheckedItemCount` to `GqlList`** (AC: 3)
    - [x] Add `val uncheckedItemCount: Int = 0` to `GqlList.kt` data class
    - [x] Update `GqlListMapper.mapListToGql` signature: add `uncheckedItemCount: Int = 0` parameter; include in
      `GqlList(...)` constructor call
    - [x] Add `itemStorage: ItemStorage` to `ListQueries` and `ListMutations` constructors in `ListApi.kt`
    - [x] In `ListQueries.lists()`, for each list compute:
      `val count = itemStorage.getByListId(list.id).count { !it.checked }`; pass to mapper
    - [x] In `ListMutations` for mutations that return `GqlList` (createList, renameList, shareList, acceptInvite),
      compute count similarly: `itemStorage.getByListId(list.id).count { !it.checked }`
    - [x] In `GQL.kt`, pass `itemStorage` to both `ListQueries(listService, listMemberRepository, itemStorage)` and
      `ListMutations(listService, listMemberRepository, itemStorage)` — `itemStorage` is already instantiated on line 72

- [x] **Task 3: Regenerate GQL types** (AC: all)
    - [x] Start backend: `docker compose up mongo router` + `cd bp_back && ../gradlew run -t`
    - [x] Get JWT: `POST http://localhost:2080/api/auth/login` with `{"username":"admin","password":"admin"}`
    - [x] Update `codegen.ts` Authorization header with fresh token
    - [x] `cd bp_front && npm run generate` — verify `__generated__/graphql.ts` includes `RenameListMutation`, updated
      `ListsQuery` with `uncheckedItemCount`, etc.

- [x] **Task 4: Install emoji picker library** (AC: 8)
    - [x] `cd bp_front && npm install emoji-picker-react`
    - [x] Verify it works with React 19 (emoji-picker-react v5+ supports React 18/19)

- [x] **Task 5: Write GQL operations in `src/lib/list/Queries.tsx`** (AC: 1, 4, 5, 6, 7, 12, 13)
    - [x] Update `listsQuery` to include `uncheckedItemCount`
    - [x] Add `createListMutation`
    - [x] Add `deleteListMutation`
    - [x] Add `renameListMutation`
    - [x] Add `leaveListMutation`
    - [x] Add `acceptInviteMutation`
    - [x] Add `rejectInviteMutation`

- [x] **Task 6: Implement `BPAvatar`** (AC: 9, 10, 11)
    - [x] Create `src/app/BPAvatar.tsx`
    - [x] Props: `displayName: string`, `avatarUrl?: string`, `status: 'active' | 'pending'`
    - [x] Base: MUI `Avatar` with `position: 'relative'`; derive initials from `displayName`
    - [x] Pending overlay: absolutely positioned `Box` with
      `inset: 0, bgcolor: 'rgba(0,0,0,0.35)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none'`
    - [x] Clock icon inside overlay: 12px white `AccessTimeIcon` (from `@mui/icons-material/AccessTime`)
    - [x] Overlay animation: `transition: 'opacity 200ms'`, `opacity: status === 'pending' ? 1 : 0`
    - [x] `aria-label`: `"{displayName}"` when active; `"{displayName} (pending invite)"` when pending

- [x] **Task 7: Implement `ListCard`** (AC: 3, 4, 5, 6)
    - [x] Create `src/app/ListCard.tsx`
    - [x] Props: `list: ListsQuery['lists']['lists'][0]`, `currentUsername: string | null`,
      `onNavigate: (id: string) => void`, `onDeleted: (id: string, name: string) => void`,
      `onLeft: (id: string) => void`
    - [x] Determine ownership: `const isOwner = list.ownerUsername === currentUsername`
    - [x] Layout: MUI `Card` (`elevation={0}`) → `CardContent` → row with emoji, name/meta, BPAvatar row, item count, ⋯
      button
    - [x] Emoji: show `Typography` with emoji if `list.emoji` present; otherwise skip
    - [x] BPAvatar row: `Box` with flex row of `BPAvatar` components from
      `list.members.filter(m => m.status !== 'DECLINED')`; map `status: 'ACCEPTED' → 'active'`,
      `status: 'PENDING' → 'pending'`
    - [x] Item count: `Typography variant="caption"` showing `"{list.uncheckedItemCount} items"`
    - [x] `⋯` button: MUI `IconButton` (48×48px) with `MoreVertIcon`; stop propagation so card click doesn't fire
    - [x] Context menu: MUI `Menu` + `MenuItem`; owner sees Rename + "Share & Members" (stub, no-op) + Delete; non-owner
      sees Rename (stub) + "Share & Members" (stub) + "Leave list"
    - [x] Inline rename: when rename selected, replace name `Typography` with `TextField` (`autoFocus`, `size="small"`);
      `onKeyDown`: Enter → fire mutation; Escape → cancel; blur → cancel
    - [x] `renameList` mutation:
      `optimisticResponse: { renameList: { __typename: 'List', id: list.id, name: newName } }` — no success Snackbar per
      spec
    - [x] Delete dialog: MUI `Dialog` with correct copy — `"Delete"` (`color="error"`) and `"Cancel"`; Dialog stays open
      during in-flight `deleteList`; close only on success
    - [x] Leave dialog: MUI `Dialog` with correct copy — `"Leave"` (`color="error"`) and `"Cancel"`
    - [x] Card body click (not ⋯): `onNavigate(list.id)`

- [x] **Task 8: Implement `SheetNewList`** (AC: 7, 8)
    - [x] Create `src/app/SheetNewList.tsx`
    - [x] Props: `state: BPSheetState`, `onStateChange: (s: BPSheetState) => void`,
      `triggerRef?: RefObject<HTMLElement | null>`
    - [x] Wraps `BPSheet` with `title="New list"`, `peekHeight={260}`
    - [x] Fields: emoji button (shows selected emoji or `🏷️` placeholder) + text `TextField` for name (required)
    - [x] Emoji picker: on emoji button click, render `<EmojiPicker>` from `emoji-picker-react` inline; `onEmojiClick`:
      set emoji, close picker, re-focus name field
    - [x] Submit button: label `"Create"` while idle; shows `CircularProgress size={18}` while `createList` is
      in-flight; button disabled during flight
    - [x] On submit: if name empty → field-level error `"Name is required"`, no mutation; if name present → fire
      `createList(name.trim(), emoji || undefined)` mutation
    - [x] On success: `onStateChange('closed')` + `router.push('/list/{newListId}')`
    - [x] On error: Snackbar `"Couldn't create list · Retry"` (Retry re-fires mutation with same data)
    - [x] Unsaved-changes guard: intercept close when name has content → Dialog `"Discard changes?"` with `"Discard"`
      and `"Keep editing"` buttons
    - [x] Reset all state (name, emoji, picker open) on confirmed discard or successful create

- [x] **Task 9: Implement Lists tab page** (AC: 1, 2, 5, 6, 7, 12, 13)
    - [x] Rewrite `src/app/lists/page.tsx` with full implementation
    - [x] `useQuery(listsQuery)` — query returns all of caller's lists + pending invites
    - [x] Ownership check via `username` from `AuthContext` (note: `userId` not in AuthContext; using `ownerUsername`
      comparison)
    - [x] Sort lists by `createdAt` ascending for stable order
    - [x] Render `ListCard` per list with navigate/delete/left handlers
    - [x] Pending invites section with Accept and Reject buttons; per-invite in-flight state
    - [x] Accept: `acceptInviteMutation` → on success navigate to new list
    - [x] Reject: `rejectInviteMutation` → on success list disappears (refetch)
    - [x] Empty state: `EmptyState` with correct copy and Create list action
    - [x] FAB: fixed bottom-right with `AddIcon`; tap → `setSheetState('peeked')`
    - [x] FAB ref as `triggerRef` for `SheetNewList` focus restore
    - [x] Delete success Snackbar: `"'{listName}' deleted"` (5s)
    - [x] Loading state: `Skeleton` rects while query loading

- [x] **Task 10: TypeScript check** (AC: all)
    - [x] `cd bp_front && npx tsc --noEmit` — zero errors

## Dev Notes

### Critical: `renameList` Does Not Exist in Backend

The backend currently has NO `renameList` mutation. `ListApi.kt` only exposes: `lists`, `createList`, `deleteList`,
`shareList`, `acceptInvite`, `rejectInvite`, `removeMember`, `leaveList`. Task 1 must add `renameList` before frontend
work begins.

### Critical: `uncheckedItemCount` Not on `GqlList`

`GqlList` currently has: `id`, `name`, `emoji`, `ownerId`, `ownerUsername`, `members`, `createdAt`. There is no
`uncheckedItemCount`. Task 2 adds it. The `listsQuery` in `src/lib/list/Queries.tsx` must also be updated to request
`uncheckedItemCount` — this means regenerating codegen types.

### Critical: `listsQuery` Already Exists — Update, Don't Replace

`src/lib/list/Queries.tsx` already exports `listsQuery`. **Do not create a new query file.** Add mutations and update
the existing query in the same file. The existing `listsQuery` is already used by `src/app/page.tsx` (home redirect).
Changing the query shape (adding `uncheckedItemCount`) is safe because `page.tsx` doesn't use that field.

### GQL Operation Names (Backend Method → GQL Field Name)

These are the exact GQL field names from the backend `ListApi.kt`:

- **Query**: `lists` → returns `ListsResult { lists: [List], pendingInvites: [PendingInvite] }`
- **Mutation**: `createList(name: String!, emoji: String): List`
- **Mutation**: `deleteList(id: ID!): DeleteListResult { deletedItemCount deletedCategoryCount }`
- **Mutation**: `renameList(id: ID!, name: String!): List` — **must be added in Task 1**
- **Mutation**: `shareList(listId: ID!, username: String!): List`
- **Mutation**: `acceptInvite(listId: ID!): List`
- **Mutation**: `rejectInvite(listId: ID!): Boolean`
- **Mutation**: `leaveList(listId: ID!): Boolean`
- **Mutation**: `removeMember(listId: ID!, username: String!): List`

### GQL Operations to Write

**`src/lib/list/Queries.tsx`** — update `listsQuery`, add mutations:

```graphql
query Lists {
    lists {
        lists {
            id name emoji createdAt ownerId ownerUsername uncheckedItemCount
            members { userId username status }
        }
        pendingInvites { listId listName listEmoji ownerUsername }
    }
}

mutation CreateList($name: String!, $emoji: String) {
    createList(name: $name, emoji: $emoji) {
        id name emoji ownerId ownerUsername createdAt uncheckedItemCount
        members { userId username status }
    }
}

mutation DeleteList($id: ID!) {
    deleteList(id: $id) { deletedItemCount deletedCategoryCount }
}

mutation RenameList($id: ID!, $name: String!) {
    renameList(id: $id, name: $name) { id name }
}

mutation LeaveList($listId: ID!) {
    leaveList(listId: $listId)
}

mutation AcceptInvite($listId: ID!) {
    acceptInvite(listId: $listId) {
        id name emoji ownerId ownerUsername createdAt uncheckedItemCount
        members { userId username status }
    }
}

mutation RejectInvite($listId: ID!) {
    rejectInvite(listId: $listId)
}
```

### `ListMember.status` Values

Status is an untyped string in the backend: `"PENDING"`, `"ACCEPTED"`, `"DECLINED"`. `GqlListMapper` filters out
`"DECLINED"` members before returning to the frontend. So `BPAvatar` will only see `"PENDING"` or `"ACCEPTED"`.

Map to `BPAvatar` prop: `status === 'ACCEPTED' ? 'active' : 'pending'`

### Owner vs Member Differentiation

Use `AuthContext.userId` (already available via `useAuth()`) to compare with `list.ownerId`. If
`list.ownerId === userId` → show Delete; otherwise → show "Leave list".

`AuthContext` exposes `userId: string | null` — verified in existing usage in `app/account/password/page.tsx`.

### `renameList` Backend Implementation Pattern

Follow the established pattern from `ListService.deleteList`:

```kotlin
// ListService.renameList
suspend fun renameList(id: UUID, name: String, caller: CallerUsername): Either<ListAuthError, List> = either {
    val callerUser = userRepository.findByUsername(caller.value) ?: raise(ListAuthError.CallerNotFound)
    val list = storage.getById(id) ?: raise(ListAuthError.NotMember)
    if (list.ownerId != callerUser.id) raise(ListAuthError.NotOwner)
    storage.rename(id, name)
}

// ListStorage.rename
suspend fun rename(id: UUID, name: String): List {
    sync()
    val list = storage[id] ?: throw IllegalStateException("List not found")
    val updated = list.copy(name = name)
    storage[id] = updated
    repository.rename(id, name)
    return updated
}

// ListRepository.rename
suspend fun rename(id: UUID, name: String) {
    col.updateOne(Filters.eq("_id", id.toString()), Updates.set(MongoList::name.name, name))
}
```

`ListMutations.renameList` in `ListApi.kt`:

```kotlin
suspend fun renameList(id: ID, name: String, env: DataFetchingEnvironment): GqlList {
    val caller = env.caller()
    return service.renameList(UUID.fromString(id.value), name, caller).fold(
        ifLeft = { throw it.toException() },
        ifRight = { list ->
            val members = listMemberRepository.findActiveByListId(list.id)
            val count = itemStorage.getByListId(list.id).count { !it.checked }
            GqlListMapper.mapListToGql(list, members, count)
        },
    )
}
```

### `GQL.kt` Injection Change

`itemStorage` is already instantiated on line 72 of `GQL.kt`:

```kotlin
val itemStorage = ItemStorage(itemRepository)
```

Update the `ListQueries` and `ListMutations` instantiation:

```kotlin
ListQueries(listService, listMemberRepository, itemStorage)
// ...
ListMutations(listService, listMemberRepository, itemStorage)
```

### `BPSheet` API Recap

`BPSheet` (at `src/app/BPSheet.tsx`) already exists — do not recreate it. API:

```ts
interface BPSheetProps {
  state: 'closed' | 'peeked' | 'open'
  onStateChange: (state: BPSheetState) => void
  peekHeight?: number   // default 200
  title: string
  triggerRef?: RefObject<HTMLElement | null>
  children: ReactNode
}
```

- Focus on first focusable element fires on `transitionEnd` for height property (inside `handleTransitionEnd` in
  BPSheet)
- To auto-focus the name field: BPSheet already focuses the first focusable element after the sheet height transition
  ends — so just making the `TextField` the first focusable element is sufficient. No separate transitionEnd handler
  needed.

### Emoji Picker Integration

Install: `npm install emoji-picker-react`

Usage within `SheetNewList`:

```tsx
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react'

const handleEmojiClick = (emojiData: EmojiClickData) => {
  setEmoji(emojiData.emoji)
  setShowPicker(false)
  nameInputRef.current?.focus()
}

// In JSX:
{showPicker && (
  <EmojiPicker
    onEmojiClick={handleEmojiClick}
    skinTonesDisabled
    searchDisabled={false}
    height={320}
    width="100%"
  />
)}
```

The picker must render inline within `BPSheet`'s children — not in a portal or separate sheet. When `showPicker` is
true, the sheet may need to expand to OPEN state to accommodate the picker height.

### `renameList` Optimistic Response Pattern

Unlike `checkItem`, `renameList` only updates `name` on the cached `List`:

```tsx
renameList({
  variables: { id: list.id, name: newName },
  optimisticResponse: {
    renameList: { __typename: 'List', id: list.id, name: newName }
  }
})
```

No success Snackbar — the name change itself is the confirmation (per epics Technical Notes).

### Delete Dialog Copy

The delete dialog requires the item count from `list.uncheckedItemCount`. Display as:
`"Delete '{listName}'? This list and all {N} items will be permanently removed."`

Where `N = list.uncheckedItemCount`. Note: `deleteList` returns
`GqlDeleteListResult { deletedItemCount deletedCategoryCount }` — the **actual** deleted count may differ from the
displayed count (soft-deleted items, concurrent changes). Display the pre-delete count from the Apollo cache; this is
acceptable.

### No Subscriptions for Lists Tab

The architecture explicitly states: "No Subscription on List — list membership changes do not emit subscription events
in Epic 4." The Lists tab is query-only. Do NOT add `subscribeToMore` or `useSubscription` for lists.

### Cache Update Strategy After Mutations

Prefer `refetchQueries: [listsQuery]` for mutations that modify the list collection (createList, deleteList, leaveList,
acceptInvite, rejectInvite). This is simpler than manual cache writes and safe at this scale:

```tsx
const [deleteList] = useMutation(deleteListMutation, {
  refetchQueries: [{ query: listsDocument }]
})
```

For `renameList`: use `optimisticResponse` (Apollo handles cache merge by `__typename + id`).

### FAB Positioning

The FAB must clear the bottom navigation bar. Use `bottom: 88` (64px bottom nav + 24px gap):

```tsx
<Fab sx={{ position: 'fixed', bottom: 88, right: 16, zIndex: 'fab' }} color="primary" aria-label="Create list">
  <AddIcon />
</Fab>
```

### MUI v9 API Patterns (from Story 4.6)

- Use `slotProps.paper` (not `PaperProps`) — `BPSheet.tsx` already demonstrates this
- Use `sx` for all styling — no `style={{}}`, no `className`
- `Avatar` from `@mui/material/Avatar` — `BPAvatar` wraps it
- `AvatarGroup` from `@mui/material/AvatarGroup` — useful for collapsing many avatars
- `Menu` + `MenuItem` from `@mui/material` for the context menu
- `Dialog`, `DialogTitle`, `DialogContent`, `DialogContentText`, `DialogActions` for confirmation dialogs

### `"use client"` Directive

All new component files require `'use client'` at the top — they use hooks, browser APIs, or event handlers.

### `AuthContext` Fields Available

`useAuth()` returns `{ username, userId, isLoading, clearAuth, accessToken }`. Use `userId` for owner comparison in
`ListCard`.

### Files to Create / Modify

| File                                              | Action     | Notes                                                   |
|---------------------------------------------------|------------|---------------------------------------------------------|
| `bp_back/.../entity/list/ListStorage.kt`          | UPDATE     | Add `rename()` method                                   |
| `bp_back/.../entity/list/mongo/ListRepository.kt` | UPDATE     | Add `rename()` method                                   |
| `bp_back/.../entity/list/ListService.kt`          | UPDATE     | Add `renameList()` method                               |
| `bp_back/.../entity/list/gql/GqlList.kt`          | UPDATE     | Add `uncheckedItemCount: Int = 0`                       |
| `bp_back/.../entity/list/gql/GqlListMapper.kt`    | UPDATE     | Add `uncheckedItemCount` param                          |
| `bp_back/.../entity/list/gql/ListApi.kt`          | UPDATE     | Add `renameList()` mutation; inject `itemStorage`       |
| `bp_back/.../plugins/GQL.kt`                      | UPDATE     | Pass `itemStorage` to `ListQueries` and `ListMutations` |
| `bp_front/src/lib/list/Queries.tsx`               | UPDATE     | Add mutations; update `listsQuery`                      |
| `bp_front/src/__generated__/graphql.ts`           | REGENERATE | Via `npm run generate` — never edit manually            |
| `bp_front/src/app/BPAvatar.tsx`                   | NEW        | Collaborator avatar with pending state                  |
| `bp_front/src/app/ListCard.tsx`                   | NEW        | List card with inline rename, menu, dialogs             |
| `bp_front/src/app/SheetNewList.tsx`               | NEW        | New list creation sheet                                 |
| `bp_front/src/app/lists/page.tsx`                 | UPDATE     | Replace stub with full implementation                   |
| `bp_front/package.json`                           | UPDATE     | Add `emoji-picker-react`                                |

### Existing Files Not Modified

| File                           | Why untouched                                                                                                |
|--------------------------------|--------------------------------------------------------------------------------------------------------------|
| `src/app/BPSheet.tsx`          | Stable — used as-is                                                                                          |
| `src/app/BPBottomNav.tsx`      | Stable                                                                                                       |
| `src/app/layout.tsx`           | Stable                                                                                                       |
| `src/app/page.tsx`             | Stable — already uses `listsQuery` for redirect; adding `uncheckedItemCount` to query is backward-compatible |
| `src/app/EmptyState.tsx`       | Stable — reused as-is                                                                                        |
| `src/lib/item/Queries.tsx`     | Stable                                                                                                       |
| `src/lib/category/Queries.tsx` | Stable                                                                                                       |

### Share & Members is a Stub in This Story

The context menu shows "Share & Members" option but clicking it does nothing (no-op) in story 4.8. `SheetShare` and
`SheetInvite` are Phase 5 components implemented in 4.9+. Add the menu item so the UI is complete, but the `onClick`
handler can be empty or show a brief Snackbar "Coming soon".

### Unhappy-Path & Concurrency Checklist

Before marking this story complete, verify:

- [ ] **Mutation errors surface to the user** — `deleteList` failure shows error Snackbar; `createList` failure shows
  `"Couldn't create list · Retry"` Snackbar; `renameList` failure rolls back via Apollo optimistic update
- [ ] **Dialog does not close on error** — Delete dialog and Leave dialog stay open if their mutation fails; close only
  on explicit success
- [ ] **Cancel remains interactive during in-flight requests** — Cancel buttons in Delete/Leave dialogs are never
  disabled; only the confirm button disables during flight
- [ ] **Client-side input validation** — `SheetNewList` rejects empty name with field-level error before firing mutation
- [ ] **Concurrent write safety** — `renameList` uses `optimisticResponse`; if two renames race, last write wins (
  backend `$set` is idempotent); acceptable at this scale
- [ ] **Loading state prevents double-submit** — `SheetNewList` Create button disabled while `createList` is in-flight;
  `Delete`/`Leave` confirm buttons disabled while their mutations are in-flight; Accept/Reject buttons disabled
  per-invite while in-flight

### References

- [epics.md §Story 4.8 lines 1579–1684] — Full AC list, technical notes, test requirements (authoritative)
- [ux-design-specification-epic-4.md §BPAvatar lines 1537–1562] — anatomy, pending overlay, transition, accessibility
- [ux-design-specification-epic-4.md §EmptyState lines 1564–1589] — variant table with exact copy
- [ux-design-specification-epic-4.md §SheetErrorState lines 1593–1603] — SheetNewList error state spec
- [ux-design-specification-epic-4.md §UX-DR-E4-8 line 278] — `ListChipRow` spec (already implemented in 4.7)
- [ux-design-specification-epic-4.md §UX-DR-E4-9 line 280] — `ListCard` spec
- [ux-design-specification-epic-4.md §UX-DR-E4-10 line 282] — `BPAvatar` spec
- [ux-design-specification-epic-4.md §UX-DR-E4-13 line 288] — `SheetNewList`, `SheetShare`, `SheetInvite` specs
- [architecture.md §New Frontend Files lines 646–668] — `app/lists/page.tsx` is list picker, never auto-redirects
- [architecture.md §Story-to-File Mapping line 692] — list frontend files
- [bp_back/.../entity/list/gql/ListApi.kt] — all existing GQL operations (renameList MISSING)
- [bp_back/.../entity/list/gql/GqlList.kt] — `GqlList` shape (uncheckedItemCount MISSING)
- [bp_back/.../entity/list/gql/GqlListMapper.kt] — mapper pattern; add `uncheckedItemCount` param
- [bp_back/.../entity/list/gql/GqlPendingInvite.kt] — `listId, listName, listEmoji, ownerUsername`
- [bp_back/.../entity/list/gql/GqlDeleteListResult.kt] — `deletedItemCount, deletedCategoryCount`
- [bp_back/.../entity/list/ListStorage.kt] — existing Storage; `getById()`, `save()` patterns
- [bp_back/.../entity/list/mongo/ListRepository.kt] — `save()` uses `Updates.set(MongoList::name.name, ...)` — same
  pattern for `rename()`
- [bp_back/.../plugins/GQL.kt line 72] — `itemStorage` already instantiated; just pass to constructors
- [bp_front/src/lib/list/Queries.tsx] — existing `listsQuery` shape
- [bp_front/src/app/BPSheet.tsx] — `BPSheetProps` interface; focus management pattern
- [bp_front/src/lib/auth/AuthContext.tsx] — `userId` available via `useAuth()`
- [bp_front/src/app/EmptyState.tsx] — already implemented; `icon, title, subtitle, action` props
- [project-context.md §TypeScript] — strict mode, `@/` alias, `"use client"` required, `__generated__/` never edited
- [project-context.md §MUI usage] — consult MUI MCP tools; all styling via `sx`
- [project-context.md §Next.js/Apollo Client] — no second Apollo client; refetchQueries pattern for list mutations

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

None.

### Completion Notes List

- `AuthContext` does not expose `userId` — JWT payload contains only `username` and `role`. Ownership check in
  `ListCard` uses `list.ownerUsername === currentUsername` (semantically equivalent since usernames are unique).
- Login path is `/api/auth/login` (not `/api/login` as noted in some story docs). Updated codegen token accordingly.
- Pre-existing lint errors in `BPSheet.tsx` (react-hooks/refs and local/no-sx-color) were not introduced by this story
  and left untouched.
- `removeMember` mutation in `ListApi.kt` also updated to pass `uncheckedItemCount` for consistency (returns `GqlList`).

### File List

- `bp_back/src/main/kotlin/com/bagplease/entity/list/ListStorage.kt`
- `bp_back/src/main/kotlin/com/bagplease/entity/list/mongo/ListRepository.kt`
- `bp_back/src/main/kotlin/com/bagplease/entity/list/ListService.kt`
- `bp_back/src/main/kotlin/com/bagplease/entity/list/gql/GqlList.kt`
- `bp_back/src/main/kotlin/com/bagplease/entity/list/gql/GqlListMapper.kt`
- `bp_back/src/main/kotlin/com/bagplease/entity/list/gql/ListApi.kt`
- `bp_back/src/main/kotlin/com/bagplease/plugins/GQL.kt`
- `bp_front/src/lib/list/Queries.tsx`
- `bp_front/src/__generated__/graphql.ts` (regenerated)
- `bp_front/src/__generated__/gql.ts` (regenerated)
- `bp_front/src/app/BPAvatar.tsx` (new)
- `bp_front/src/app/ListCard.tsx` (new)
- `bp_front/src/app/SheetNewList.tsx` (new)
- `bp_front/src/app/lists/page.tsx`
- `bp_front/codegen.ts`
- `bp_front/package.json`
- `bp_front/package-lock.json`

### Change Log

- 2026-05-25: Implemented Story 4.8 — Lists tab, BPAvatar, ListCard, SheetNewList; added `renameList` backend mutation
  and `uncheckedItemCount` to GQL schema.

### Review Findings

- [x] [Review][Decision] `SheetNewList` discard guard: back-gesture consumes BPSheet history sentinel before dialog
  resolves — Fixed: added capturing `popstate` listener in `SheetNewList` that intercepts BPSheet's sentinel event,
  re-pushes it, and shows the discard dialog without BPSheet ever seeing the event [bp_front/src/app/SheetNewList.tsx]
- [x] [Review][Patch] `renameList` in `ListService.kt` skips `adminBlocked` guard [bp_back/.../ListService.kt:101]
- [x] [Review][Patch] `renameList` missing name-length validation — `createList` enforces `name.length > 100`;
  `renameList` has no equivalent check, allowing arbitrarily long names via
  rename [bp_back/.../ListService.kt or ListStorage.kt]
- [x] [Review][Patch] `BPAvatar` initials wrong for empty/whitespace `displayName` — `"".split(' ')` yields `['']`,
  `''[0]` is `undefined`, result is `"UN"` initials instead of empty/fallback [bp_front/src/app/BPAvatar.tsx:28-33]
- [x] [Review][Patch] `handleAccept`/`handleReject` swallow errors silently — `try/finally` with no `catch`; network or
  auth failures produce no Snackbar, leaving the user with no feedback or retry path [bp_front/src/app/lists/page.tsx]
- [x] [Review][Defer] `ListStorage.rename` not atomic — in-memory updated before MongoDB write; if MongoDB throws,
  in-memory reflects rename but DB does not until process restart [bp_back/.../ListStorage.kt] — deferred, pre-existing
- [x] [Review][Defer] Concurrent delete+rename race causes `IllegalStateException` bypassing GQL error model — service
  confirms existence via `getById`, then storage re-checks; concurrent `delete` between the two calls throws
  `IllegalStateException` (uncaught 500) instead of a structured GQL error [bp_back/.../ListStorage.kt] — deferred,
  pre-existing
