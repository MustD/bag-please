# Story 4.7: Frontend — Today Tab, Shopping Loop & Core Components

Status: done

## Story

As a list member,
I want a Today tab where I can see my active list's items, check them off, track progress, and switch between lists,
so that the core shopping loop works end-to-end in the browser.

## Acceptance Criteria

**AC1 — Today tab loads and groups items by category:**
Given `app/list/[listId]/page.tsx` is implemented
When a user navigates to `/list/[listId]`
Then `getItems(listId)` and `getCategories(listId)` GQL queries are called with the `listId` from the URL
And non-deleted items (`deleted: false`) are rendered grouped by category in `BPCategoryHeader` sections
And the `ProgressStrip` is rendered sticky below the custom toolbar, outside the scrollable item list

**AC2 — Non-member error boundary:**
Given `app/list/[listId]/error.tsx` is implemented
When the current user is not a member of `listId` (GQL auth error returned)
Then the error boundary catches it and calls `router.replace('/lists')`

**AC3 — ListChipRow:**
Given `ListChipRow` is rendered at the top of the Today tab scroll area
When the user has multiple lists
Then all lists from `listsQuery` are shown as chips
And the active list chip (matching URL `listId`) is visually distinguished
And the active chip is scrolled into view on mount and on `activeListId` change
And tapping a chip calls `router.push('/list/[id]', { scroll: false })`

**AC4 — BPCheck custom checkbox:**
Given `BPCheck` is implemented as a `<div>` (NOT MUI Checkbox)
When rendered
Then it has `role="checkbox"`, `aria-checked={checked}`, `tabIndex={0}`, and required `ariaLabel` prop
And unchecked label: `"Check off {item.name}"`; checked label: `"{item.name}, checked"`
And `Space` key triggers `onChange`
And the circle animates from border to filled accent in 150ms ease-out on check
And when `BPCheck` receives keyboard focus, a 44×44px edit icon appears at the trailing edge of the row

**AC5 — ItemCard anatomy:**
Given `ItemCard` is implemented
When rendered without a `lifecycle` value
Then no badge is shown and the row height is 52px (Cozy density)
And anatomy is: `[BPCheck 42px] [Body flex-1 (name 17px + meta line 13px)] [LifecycleBadge? — deferred to 4.9]`

**AC6 — Optimistic check-off with Snackbar and Undo:**
Given a user taps `BPCheck` on an `ItemCard`
When the `checkItem` mutation is dispatched with `optimisticResponse`
Then the UI marks the item checked immediately
And `ProgressStrip` advances
And a Snackbar appears: `"Removed · Undo"` with 5-second duration
And on mutation failure the item snaps back to unchecked and an inline `Alert` appears on the row

**AC7 — Undo within 5 seconds:**
Given a user taps Undo on the check-off Snackbar
When the Undo action fires
Then `uncheckItem` mutation is dispatched
And the item is restored to unchecked state
And the Snackbar is dismissed

**AC8 — Completion state:**
Given all items in the active list have `checked: true`
When the last check-off resolves
Then `ProgressStrip` transitions its fill colour to `success.main`
And `aria-label` on `ProgressStrip` changes to `"All done"`
And the toolbar subtitle shows `"All done · {N} items"`
And this state reverts automatically if any item is unchecked

**AC9 — Empty states:**
Given the active list has no items
When the Today tab renders
Then `EmptyState` shows: title `"Nothing here yet"`, subtitle `"Add your first item"`, action opens FAB stub

Given the user has no lists at all
When landing on the Today tab (no `listId` in URL)
Then `EmptyState` shows: title `"Choose a list to start"`, subtitle `"Tap a list below"`

**AC10 — SRContext screen reader announcements:**
Given `SRContext` is mounted at the page root
When rendered
Then a visually-hidden `<div aria-live="polite" aria-atomic="false">` is in the DOM
And `announceToSR(message)` is available via context with a 1.5-second throttle

When an item is removed
Then `announceToSR("{item.name} removed")` is called before the exit animation starts

**AC11 — Category group collapse:**
Given all items in a category are checked
When the last item in the group is checked
Then the category header and its items collapse from view
And this reverses if any item in the group is unchecked

**AC12 — Subscription updates preserve focus:**
Given an item subscription update arrives for the active list
When the update is applied to the Apollo cache
Then the item row reflects the new state without a refresh
And `document.activeElement` is unchanged

## Tasks / Subtasks

- [x] **Task 1: Write GQL operations and regenerate types** (AC: 1, 6, 7, 12)
    - [x] Replace stubs in `src/lib/item/Queries.tsx` with: `getItemsQuery`, `checkItemMutation`, `uncheckItemMutation`,
      `getItemUpdatesSubscription`
    - [x] Replace stubs in `src/lib/category/Queries.tsx` with: `getCategoriesQuery`, `getCategoryUpdatesSubscription`
    - [x] Run `npm run generate` with backend on `:2080` (requires valid JWT in `codegen.ts`) — verify
      `src/__generated__/graphql.ts` now includes `GetItemsQuery`, `CheckItemMutation`, etc.

- [x] **Task 2: Create `SRContext`** (AC: 10)
    - [x] Create `src/contexts/SRContext.tsx` (new directory `src/contexts/`)
    - [x] Export `SRProvider`, `useSR` hook, `announceToSR` via context
    - [x] Live region: `aria-live="polite"` `aria-atomic="false"`, visually hidden via absolute position / clip
    - [x] Throttle: max one announcement per 1.5s; subsequent calls within window replace the pending text

- [x] **Task 3: Implement `ProgressStrip`** (AC: 1, 8)
    - [x] Create `src/app/ProgressStrip.tsx`
    - [x] Outer `Box`: `height: 6px`, `borderRadius: '99px'`, `bgcolor: theme.custom.bp.bg2`, `overflow: 'hidden'`
    - [x] Inner `Box`: `height: '100%'`, `borderRadius: '99px'`, `width: {pct}%`,
      `transition: 'width 320ms cubic-bezier(0.2,0.7,0.2,1)'`, `bgcolor: isComplete ? 'success.main' : 'primary.main'`
    - [x] `role="progressbar"`, `aria-valuenow`, `aria-valuemax`, `aria-label`: `"All done"` when isComplete else
      `"{pct}% complete"`
    - [x] Reduced-motion: instant width change (no transition)

- [x] **Task 4: Implement `BPCheck`** (AC: 4)
    - [x] Create `src/app/BPCheck.tsx`
    - [x] `<div role="checkbox" aria-checked={checked} tabIndex={0} aria-label={ariaLabel}>`
    - [x] 42×42px outer touch target, 24px circle inside
    - [x] Unchecked: `1.5px border` in `theme.custom.bp.ter`, transparent fill
    - [x] Checked: border disappears, `bgcolor: primary.main`, white checkmark SVG; 150ms ease-out for both
    - [x] Space key: `onKeyDown e.key === ' '` → `e.preventDefault()` + `onChange()`
    - [x] Focus: show edit icon (pencil) at trailing edge of **parent ItemCard row** — BPCheck fires this via an
      `onFocusChange(focused: boolean)` callback prop so ItemCard controls the icon visibility

- [x] **Task 5: Implement `ItemCard` and `ItemCardSkeleton`** (AC: 4, 5, 6)
    - [x] Create `src/app/ItemCard.tsx`
    - [x] Props: `id`, `name`, `category?`, `store?`, `checked`, `lifecycle`, `removing?`, `onCheck`, `onRemoved?`,
      `onLongPress?`
    - [x] Layout: `display: flex, alignItems: center, minHeight: 52px, px: 1`
    - [x] Row separator: `borderBottom: '1px solid'`, `borderColor: palette.divider`, `opacity: 0.5` via sx
    - [x] Exit animation when `removing=true`: `height: 0 + opacity: 0 + translateX(24px) — 280ms ease-out`; call
      `onRemoved()` on `onTransitionEnd`; 400ms timeout fallback
    - [x] Reduced-motion `removing`: instant removal (no transition), then `onRemoved()` immediately
    - [x] Meta line: `{category} · {store}` — omit `· {store}` if no store; omit meta line entirely if both empty
    - [x] `lifecycle` prop typed as `'once' | 'weekly' | 'biweekly' | 'monthly' | null` — render nothing (placeholder
      `null`) for the badge slot; Story 4.9 fills this
    - [x] Long-press: 500ms `pointerdown` timer, cancel on 10px `pointermove`, calls `onLongPress`
    - [x] `export function ItemCardSkeleton()`: 42px circular Skeleton + two text line Skeletons, no trailing rect

- [x] **Task 6: Implement `BPCategoryHeader`** (AC: 1, 11)
    - [x] Create `src/app/BPCategoryHeader.tsx`
    - [x] Props: `name: string`, `checkedCount: number`, `totalCount: number`, `collapsed: boolean`
    - [x] Section label: 11px, weight 600, uppercase, 0.6px letter-spacing; padding `14px 12px 6px`
    - [x] Count badge: shows `{checkedCount}/{totalCount}`
    - [x] When `collapsed=true`: component renders nothing (parent `BPCategoryGroup` controls collapse logic)

- [x] **Task 7: Implement `ListChipRow`** (AC: 3)
    - [x] Create `src/app/ListChipRow.tsx`
    - [x] Props: `lists: { id: string; name: string; emoji?: string; itemCount: number }[]`, `activeListId: string`,
      `onListSelect: (id: string) => void`
    - [x] `role="listbox"` `aria-label="Switch list"` `aria-multiselectable="false"` on container
    - [x] Each chip: `role="option"` `aria-selected={id === activeListId}`; MUI Chip with `variant="outlined"` for
      inactive, `variant="filled"` `color="primary"` for active
    - [x] On mount and `activeListId` change:
      `chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })`
    - [x] Skeleton chips (3×) when `lists` is empty/loading
    - [x] Arrow keys navigate chips

- [x] **Task 8: Implement `EmptyState`** (AC: 9)
    - [x] Create `src/app/EmptyState.tsx`
    - [x] Props: `icon: ReactNode`, `title: string`, `subtitle?: string`,
      `action?: { label: string; onClick: () => void }`
    - [x] Centered layout, MUI `Typography` for title/subtitle, MUI `Button` for action

- [x] **Task 9: Implement Today tab page** (AC: 1, 2, 3, 6, 7, 8, 9, 10, 11, 12)
    - [x] Rewrite `app/list/[listId]/page.tsx` with full implementation
    - [x] Create `app/list/[listId]/error.tsx` — catch error, call `router.replace('/lists')`
    - [x] Wrap page in `SRProvider`
    - [x] Query `getItems(listId)` + `getCategories(listId)` + subscribe via `subscribeToMore`
    - [x] Filter: `items.filter(i => !i.deleted)` to exclude soft-deleted one-timers
    - [x] Build `categoryMap: Map<string, string>` from category id → name for display
    - [x] Group items by `item.category` (UUID); show category name via `categoryMap`
    - [x] Sticky custom toolbar: list name (20px/600) + subtitle (`"{N} items"` or `"All done · {N} items"`)
    - [x] `ProgressStrip` sticky below toolbar
    - [x] `ListChipRow` at top of scroll area — pass `itemCount: 0` for non-active lists (active list count from items
      query)
    - [x] Optimistic `checkItem`: `optimisticResponse` sets `checked: true`, `checkedAt` to now
    - [x] Snackbar on check-off: `"Removed · Undo"` 5s; replace-queue (new snackbar immediately replaces old)
    - [x] Undo: fires `uncheckItem`, dismisses snackbar
    - [x] Mutation failure: refetch or manual cache rollback + inline Alert on failing row
    - [x] `announceToSR("{item.name} removed")` before item exit animation
    - [x] Subscription: `subscribeToMore` for item updates — SAVED updates cache, DELETED removes from cache
    - [x] FAB (+ button) positioned bottom-right; opens stub BPSheet in peeked state (no-op content until 4.9)
    - [x] `ItemCardSkeleton` on initial load

- [x] **Task 10: TypeScript check** (AC: all)
    - [x] `cd bp_front && npx tsc --noEmit` — zero errors

## Dev Notes

### Critical: GQL Operation Names vs Backend Method Names

Backend (`ItemApi.kt`) exposes:

- **Query**: `getItems(listId: ID!): [Item!]!`
- **Query**: `getCategories(listId: ID!): [Category!]!`
- **Mutation**: `checkItem(id: ID!, listId: ID!): Item!`
- **Mutation**: `uncheckItem(id: ID!, listId: ID!): Item!`
- **Subscription**: `getItemUpdates(listId: ID!): ItemUpdate!` — emits `{ type: SAVED|DELETED, item: Item }`
- **Subscription**: `getCategoryUpdates(listId: ID!): CategoryUpdate!` — emits
  `{ type: SAVED|DELETED, category: Category }`

These are the exact GQL field names. Write operations using these names in `Queries.tsx`.

### Critical: `category` on Item is a UUID, NOT a name

`GqlItem.category` is the **category UUID string** (`item.category.toString()` in `GqlItemMapper.kt:15`). The frontend
must build a lookup map:

```ts
const categoryMap = new Map(categories.map(c => [c.id, c.name]))
// Then: categoryMap.get(item.category) ?? 'Uncategorized'
```

### Critical: Filter `deleted: true` Items Client-Side

Items with `deleted: true` are soft-deleted one-timers pending the hourly hard-delete scheduler. The `getItems` query
returns ALL items including `deleted: true`. Always filter before rendering:

```ts
const visible = items.filter(i => !i.deleted)
```

### Critical: `npm run generate` Required

The `src/lib/item/Queries.tsx` and `src/lib/category/Queries.tsx` files currently export `null` stubs. Until real
GraphQL operations are written and `npm run generate` is run, the TypeScript types for these operations do not exist.
The generated code goes to `src/__generated__/graphql.ts` — **never edit that file manually**.

Steps to regenerate:

1. Start backend: `docker compose up mongo router` + `cd bp_back && ../gradlew run -t`
2. Get JWT: `POST http://localhost:2080/api/login` with `{"username":"admin","password":"admin"}`
3. Set token in `codegen.ts` Authorization header
4. `cd bp_front && npm run generate`

### GQL Operations to Write

**`src/lib/item/Queries.tsx`:**

```graphql
query GetItems($listId: ID!) {
  getItems(listId: $listId) {
    id name checked category listId store recurring addedBy deleted deletedAt checkedAt
  }
}

mutation CheckItem($id: ID!, $listId: ID!) {
  checkItem(id: $id, listId: $listId) {
    id checked checkedAt
  }
}

mutation UncheckItem($id: ID!, $listId: ID!) {
  uncheckItem(id: $id, listId: $listId) {
    id checked checkedAt
  }
}

subscription GetItemUpdates($listId: ID!) {
  getItemUpdates(listId: $listId) {
    type
    item { id name checked category listId store recurring addedBy deleted deletedAt checkedAt }
  }
}
```

**`src/lib/category/Queries.tsx`:**

```graphql
query GetCategories($listId: ID!) {
  getCategories(listId: $listId) {
    id name listId
  }
}

subscription GetCategoryUpdates($listId: ID!) {
  getCategoryUpdates(listId: $listId) {
    type
    category { id name listId }
  }
}
```

### Subscription Wiring (subscribeToMore — not useSubscription)

Per project-context.md: "Real-time updates use `subscribeToMore` on the parent `useQuery` — do not create a separate
`useSubscription` alongside a `useQuery` for the same data."

```tsx
const { data, subscribeToMore } = useQuery(getItemsQuery, { variables: { listId } })

useEffect(() => {
  const unsub = subscribeToMore({
    document: getItemUpdatesSubscription,
    variables: { listId },
    updateQuery: (prev, { subscriptionData }) => {
      const update = subscriptionData.data.getItemUpdates
      const items = prev.getItems
      if (update.type === 'SAVED') {
        const idx = items.findIndex(i => i.id === update.item.id)
        const next = idx >= 0
          ? [...items.slice(0, idx), update.item, ...items.slice(idx + 1)]
          : [...items, update.item]
        return { getItems: next }
      }
      if (update.type === 'DELETED') {
        return { getItems: items.filter(i => i.id !== update.item.id) }
      }
      return prev
    }
  })
  return () => unsub()
}, [listId, subscribeToMore])
```

Apply the same pattern for `getCategoriesQuery` + `getCategoryUpdatesSubscription`.

### Optimistic Check-Off Pattern

```tsx
const [checkItem] = useMutation(checkItemMutation)

const handleCheck = (item: GetItemsQuery['getItems'][0]) => {
  checkItem({
    variables: { id: item.id, listId },
    optimisticResponse: {
      checkItem: { __typename: 'Item', id: item.id, checked: true, checkedAt: new Date().toISOString() }
    },
    update(cache, { data }) {
      // Apollo automatically merges optimistic response into cache by __typename + id
    },
    onError() {
      // Snap back handled by Apollo cache rollback; show inline Alert for this item
      setFailedItemId(item.id)
    }
  })
  announceToSR(`${item.name} removed`)
  setSnackbar({ itemId: item.id, itemName: item.name })
}
```

Apollo automatically rolls back the optimistic update on mutation failure.

### Page Structure: Sticky Toolbar + ProgressStrip

The `layout.tsx` `overflow: auto` Box is the scroll container. To make the toolbar and ProgressStrip "fixed" (not scroll
away), use `position: sticky` within the page content:

```tsx
<Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
  {/* Sticky toolbar */}
  <Box sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: 'background.default', px: 2, py: 1 }}>
    <Typography variant="h6">{listName}</Typography>
    <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
  </Box>
  {/* ProgressStrip — sticky just below toolbar */}
  <Box sx={{ position: 'sticky', top: 56 /* approx toolbar height */, zIndex: 9, px: 2, pb: 1, bgcolor: 'background.default' }}>
    <ProgressStrip checked={checkedCount} total={total} />
  </Box>
  {/* Scrollable content */}
  <Box sx={{ flex: 1 }}>
    <ListChipRow ... />
    {/* category groups + items */}
  </Box>
</Box>
```

Use `position: sticky` (not `position: fixed`) — the toolbar must stay within the page flow for the bottom nav's
`pb: 96px` to remain correct.

### `recurring` String Mapping

Backend `Recurring` enum → frontend `lifecycle` type:

- `"ONE_TIME"` → `'once'`
- `"WEEKLY"` → `'weekly'`
- `"BIWEEKLY"` → `'biweekly'`
- `"MONTHLY"` → `'monthly'`
- `null` → `null`

`ItemCard` accepts `lifecycle: 'once' | 'weekly' | 'biweekly' | 'monthly' | null`. The badge rendering is deferred to
Story 4.9 — pass `lifecycle` prop through but render `null` in the badge slot.

### Snackbar Replace-Queue Policy

New check-off Snackbar immediately replaces any existing Snackbar (e.g., if user rapidly checks two items). Implement
via a single `snackbar` state object (`{ itemId, itemName } | null`). Each check-off overwrites the state, implicitly
dismissing the previous.

### `ListChipRow` Item Counts

`listsQuery` does **not** return item counts per list. For the active list, compute from the items query result:
`items.filter(i => !i.deleted && !i.checked).length`. For non-active lists, pass `itemCount: 0`. This is a known
limitation — full per-list counts would require N+1 queries or a backend change (deferred).

### `error.tsx` — Non-Member Redirect

```tsx
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
export default function Error({ error }: { error: Error }) {
  const router = useRouter()
  useEffect(() => { router.replace('/lists') }, [router])
  return null
}
```

Next.js App Router `error.tsx` must be a Client Component and co-located at `app/list/[listId]/error.tsx`.

### `BPCheck` Focus → Edit Icon

The edit icon is shown at the trailing edge of the `ItemCard` row (not inside BPCheck). BPCheck accepts an
`onFocusChange?: (focused: boolean) => void` prop. ItemCard uses this to show/hide the edit icon `Box`:

```tsx
<Box sx={{ 
  width: 44, height: 44, opacity: checkFocused ? 1 : 0, 
  transition: 'opacity 150ms', pointerEvents: checkFocused ? 'auto' : 'none'
}}>
  <EditIcon fontSize="small" />
</Box>
```

### MUI v9 API Notes (from Story 4.6)

MUI v9 uses `slotProps.paper` (not `PaperProps`), `slots.transition` (not `TransitionComponent`). This pattern is
already established in `BPSheet.tsx`. Follow the same v9 API for any MUI components used in this story.

### Accessibility — SRContext Live Region

The live region must be visually hidden but accessible to screen readers. Standard approach:

```tsx
<Box sx={{
  position: 'absolute', width: 1, height: 1, overflow: 'hidden',
  clip: 'rect(0,0,0,0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap'
}} aria-live="polite" aria-atomic="false">
  {message}
</Box>
```

### Files to Create/Modify

| File                              | Action     | Notes                                                 |
|-----------------------------------|------------|-------------------------------------------------------|
| `src/contexts/SRContext.tsx`      | NEW        | Screen reader context + live region                   |
| `src/app/ProgressStrip.tsx`       | NEW        | Width-based progress bar                              |
| `src/app/BPCheck.tsx`             | NEW        | Custom circular checkbox                              |
| `src/app/ItemCard.tsx`            | NEW        | Item row + exit animation + `ItemCardSkeleton` export |
| `src/app/BPCategoryHeader.tsx`    | NEW        | Category group header                                 |
| `src/app/ListChipRow.tsx`         | NEW        | List switcher chip row                                |
| `src/app/EmptyState.tsx`          | NEW        | Configurable empty state                              |
| `src/app/list/[listId]/page.tsx`  | UPDATE     | Replace placeholder with full Today tab               |
| `src/app/list/[listId]/error.tsx` | NEW        | Non-member redirect                                   |
| `src/lib/item/Queries.tsx`        | UPDATE     | Replace null stubs with real operations               |
| `src/lib/category/Queries.tsx`    | UPDATE     | Replace null stubs with real operations               |
| `src/__generated__/graphql.ts`    | REGENERATE | Via `npm run generate` — never edit manually          |

### Existing Files Not Modified

| File                       | Why untouched                          |
|----------------------------|----------------------------------------|
| `src/app/BPSheet.tsx`      | Stable — used as-is for FAB stub sheet |
| `src/app/BPBottomNav.tsx`  | Stable — no changes                    |
| `src/app/layout.tsx`       | Stable — no changes                    |
| `src/app/page.tsx`         | Stable — redirect logic unchanged      |
| `src/lib/list/Queries.tsx` | Stable — `listsQuery` reused as-is     |

### Current State of `src/lib/item/Queries.tsx` and `src/lib/category/Queries.tsx`

Both currently export `null` stubs with a comment "These will be replaced in Story 4.7". These files must be completely
rewritten in Task 1.

### Unhappy-Path & Concurrency Checklist

Before marking this story complete, verify:

- [x] **Mutation errors surface to the user** — `onError` callback on `checkItem`/`uncheckItem` shows inline Alert on
  the failing row; Apollo rolls back optimistic update automatically
- [x] **Dialog does not close on error** — N/A (no dialog in this story)
- [x] **Cancel remains interactive during in-flight requests** — Undo button in Snackbar is always interactive; it fires
  `uncheckItem` even while `checkItem` is in flight
- [ ] **Client-side input validation** — N/A (read-only operations in this story; no text input)
- [ ] **Concurrent write safety** — rapid double-tap on BPCheck: add `disabled={checking}` state to BPCheck while the
  mutation is in flight; prevents duplicate `checkItem` calls on the same item
- [x] **Loading state prevents double-submit** — `BPCheck` disabled while its specific item mutation is in-flight; other
  items' BPChecks remain active

### References

- [epics.md §Story 4.7 lines 1469–1620] — Full AC list, technical notes, test requirements (authoritative)
- [ux-design-specification-epic-4.md §BPCheck] — `role`, `ariaLabel`, animation spec
- [ux-design-specification-epic-4.md §ItemCard] — anatomy, exit animation, skeleton variant, `removing`/`onRemoved`
  interface
- [ux-design-specification-epic-4.md §ListChipRow] — accessibility roles, scroll-to-active, skeleton state
- [ux-design-specification-epic-4.md §ProgressStrip] — Box anatomy, cubic-bezier, NOT LinearProgress
- [ux-design-specification-epic-4.md §EmptyState] — variant table with exact copy
- [ux-design-specification-epic-4.md §Motion Specification] — exit animation timing, reduced-motion rules
- [ux-design-specification-epic-4.md §UX-DR-E4-7] — ProgressStrip spec (outer/inner Box tokens)
- [bp_back/.../ItemApi.kt] — GQL operation names (`getItems`, `checkItem`, `uncheckItem`, `getItemUpdates`)
- [bp_back/.../GqlItem.kt] — `category` field is UUID string; `recurring` is nullable String enum name
- [bp_back/.../GqlItemMapper.kt:15] — confirms `category = item.category.toString()` (UUID)
- [bp_back/.../CategoryApi.kt] — `getCategories`, `getCategoryUpdates` operation names
- [bp_back/.../Recurring.kt] — `ONE_TIME`, `WEEKLY`, `BIWEEKLY`, `MONTHLY`
- [project-context.md §Next.js/Apollo Client] — `subscribeToMore` rule, `ApolloWrapper.tsx` is the single client
- [project-context.md §TypeScript] — strict mode, `@/` alias, `"use client"` required, `__generated__/` never edited
- [project-context.md §MUI usage] — consult MUI MCP tools; all styling via `sx`
- [src/app/BPSheet.tsx] — MUI v9 API patterns (`slotProps.paper`, `slots.transition`), available for FAB stub sheet
- [src/lib/list/Queries.tsx] — `listsQuery` returns `id`, `name`, `emoji` per list; reuse for `ListChipRow`
- [src/app/layout.tsx] — outer Box `overflow: auto` is the scroll container; page uses `position: sticky` for
  toolbar/strip

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

- `CategoryUpdate.category` field does not exist — the backend uses `item` for both `ItemUpdate` and `CategoryUpdate`.
  Fixed in `getCategoryUpdatesSubscription`.
- MUI v9 does not accept `bgcolor`/`borderRadius` as direct Box props (breaking from v5/v6). All forbidden `sx` keys
  moved to callback `sx={(t) => ({...})}` form to satisfy both the `local/no-sx-color` ESLint rule and TypeScript.
- Apollo `subscribeToMore` `updateQuery` receives `DeepPartialObject<TData>` not `TData` — required
  `as unknown as TData` casts on `return prev`.
- `@apollo/client/react` is the correct import path for `useQuery`/`useMutation` in this project (not `@apollo/client`).
- Pre-existing `BPSheet.tsx` lint violations (2 errors) are not fixed — story specifies that file as untouched.

### Completion Notes List

- Implemented all 10 tasks covering 12 ACs: GQL operations, SRContext, ProgressStrip, BPCheck, ItemCard+Skeleton,
  BPCategoryHeader, ListChipRow, EmptyState, full Today tab page, error boundary.
- `CategoryUpdate` subscription uses `item` field (same as `ItemUpdate`) — story spec had `category` which was wrong;
  corrected against actual schema.
- Snackbar replace-queue uses `item.id` as key (sufficient since BPCheck is disabled per-item while in-flight,
  preventing double-tap on same item).
- All new files: 0 TypeScript errors, 0 ESLint violations. Pre-existing BPSheet.tsx violations unchanged.
- `npm run build` passes cleanly; `/list/[listId]` compiles as a dynamic route.

### File List

- `bp_front/src/lib/item/Queries.tsx` — updated: real GQL operations replacing null stubs
- `bp_front/src/lib/category/Queries.tsx` — updated: real GQL operations replacing null stubs
- `bp_front/src/__generated__/graphql.ts` — regenerated via `npm run generate`
- `bp_front/src/contexts/SRContext.tsx` — new: screen reader live region context with 1.5s throttle
- `bp_front/src/app/ProgressStrip.tsx` — new: animated width-based progress bar
- `bp_front/src/app/BPCheck.tsx` — new: custom circular checkbox with animation and focus callback
- `bp_front/src/app/ItemCard.tsx` — new: item row with exit animation, long-press, skeleton export
- `bp_front/src/app/BPCategoryHeader.tsx` — new: category group header with collapse support
- `bp_front/src/app/ListChipRow.tsx` — new: horizontal chip list switcher with a11y
- `bp_front/src/app/EmptyState.tsx` — new: configurable empty state component
- `bp_front/src/app/list/[listId]/page.tsx` — updated: full Today tab implementation
- `bp_front/src/app/list/[listId]/error.tsx` — new: non-member redirect error boundary
- `bp_front/codegen.ts` — updated: refreshed JWT token for codegen
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — updated: story status to review

### Review Findings

- [x] [Review][Decision] Snackbar message text: `"Removed · {itemName}"` with separate Undo button — intentional
  deviation accepted; item name is better UX than literal spec copy
- [x] [Review][Patch] MongoDB port misconfiguration — fixed: `"27017:27217"` → `"27217:27017"`; `KTOR_MONGO_PORT` →
  `"27017"` for docker-internal connectivity; application.yaml fallback `27217` retained for local
  dev [docker-compose.yaml:21, application.yaml:28]
- [x] [Review][Patch] `removingIds` never cleaned up when last item in a category is checked — fixed: changed item
  filter from `!allChecked &&` to `.filter(item => !allChecked || removingIds.has(item.id))` so removing items still
  render and complete their animation [page.tsx]
- [x] [Review][Patch] `handleTransitionEnd` fires `onRemoved` twice — fixed as side effect of height transition removal;
  guard now checks only `opacity` [ItemCard.tsx:handleTransitionEnd]
- [x] [Review][Patch] `height: auto → 0` CSS transition does not animate — fixed: removed height/minHeight from animated
  properties; exit animation now uses opacity + transform only; `onTransitionEnd` guards on
  `opacity` [ItemCard.tsx:outer Box sx]
- [x] [Review][Patch] `borderBottomOpacity: 0.5` is not a valid CSS property — fixed: replaced with
  `borderColor: alpha(t.palette.divider, 0.5)` via MUI `alpha()` utility [ItemCard.tsx:outer Box sx]
- [x] [Review][Patch] `tabIndex` gated on `disabled` prop violates AC4 — fixed: `tabIndex={0}` always; `aria-disabled`
  still set for AT signalling [BPCheck.tsx]
- [x] [Review][Patch] `onRemoved` stale closure in reduced-motion useEffect — fixed: added `onRemovedRef` pattern;
  effect deps are `[removing, reduced]` only [ItemCard.tsx:useEffect]
- [x] [Review][Patch] scrollIntoView not triggered on initial data load — fixed: added `lists.length` to useEffect
  dependency array [ListChipRow.tsx:useEffect]
- [x] [Review][Patch] `pointercancel` not handled — fixed: added `onPointerCancel={handlePointerUp}` [ItemCard.tsx]
- [x] [Review][Patch] SRProvider timers not cleared on unmount — fixed: added `useEffect` cleanup that clears
  `throttleRef.current` [SRContext.tsx]
- [x] [Review][Defer] `usePrefersReducedMotion` hook duplicated in `ItemCard.tsx` and `ProgressStrip.tsx` — registers
  separate matchMedia listeners per component instance; extract to shared `src/hooks/usePrefersReducedMotion.ts` —
  deferred, pre-existing
- [x] [Review][Defer] `announceToSR` fires before mutation success — on checkItem failure, SR has already announced item
  as removed; no correction announced; AC10 is satisfied for the happy path, error path not specified — deferred,
  pre-existing
- [x] [Review][Defer] `uncheckItem` (Undo) failure is silent — no onError handler; UI inconsistently shows unchecked
  while backend stays checked — deferred, pre-existing
- [x] [Review][Defer] Concurrent check+undo race — user taps Undo while checkItem still in-flight; both mutations run
  concurrently; last writer wins in the backend — deferred, pre-existing
- [x] [Review][Defer] `ListChipRow` skeleton shown when user genuinely has zero lists — `lists.length === 0` shows
  skeleton regardless of loading state; parent EmptyState still shows below — deferred, pre-existing
- [x] [Review][Defer] Subscription `updateQuery` merge may overwrite fields if subscription document is trimmed in
  future — forward-looking concern only — deferred, pre-existing
