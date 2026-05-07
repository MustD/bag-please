# Architecture — bp_front (Frontend)

## Executive Summary

`bp_front` is a Next.js 16 App Router frontend for the Bag Please shopping list app. It uses Apollo Client for all
GraphQL communication, with automatic HTTP/WebSocket splitting for subscriptions. Real-time updates are received via
`subscribeToMore` on existing queries. The UI is built entirely with MUI v9. Authentication state is stored in
`localStorage`.

## Technology Stack

| Category                | Technology                        | Version                         |
|-------------------------|-----------------------------------|---------------------------------|
| Language                | TypeScript                        | 6.0.3 (strict mode)             |
| Framework               | Next.js                           | 16.2.4 (App Router, standalone) |
| UI                      | React                             | 19.2.5                          |
| Component library       | MUI (Material UI)                 | 9.0.0                           |
| Icon library            | @mui/icons-material               | 9.0.0                           |
| Styling                 | Emotion                           | 11.14.x                         |
| GraphQL client          | Apollo Client                     | 4.1.9                           |
| Apollo / Next.js bridge | @apollo/client-integration-nextjs | 0.14.5                          |
| Subscriptions transport | graphql-ws                        | 6.0.8                           |
| State utilities         | Immutable.js                      | 5.1.5                           |
| UUID generation         | uuid                              | 14.0.0                          |
| Code generation         | graphql-codegen CLI               | 7.0.0                           |
| Build output            | Standalone (for Docker)           | —                               |

## Architecture Pattern: App Router + Apollo + Subscription-per-Query

```
Browser
  └── Next.js App Router
        ├── Server Components (layout.tsx, page shells) — no hooks/browser APIs
        └── Client Components ("use client") — all interactive and data-fetching UI

        Apollo Client (single instance via ApolloWrapper.tsx)
          ├── HTTP link → /api/graphql (queries + mutations)
          └── WebSocket link → /api/subscriptions (subscriptions)
              (split by operation type)
```

## Page / Route Structure

```
/              → app/page.tsx        (redirects or home)
/auth          → app/auth/page.tsx   (login form)
/store         → app/store/page.tsx  (to-buy list with items + FAB)
/store/item    → app/store/item/page.tsx   (item management — add/edit)
/store/category → app/store/category/page.tsx (category table — add/edit/search)
```

Navigation is a dropdown hamburger menu in the AppBar. Context-sensitive — sub-navigation (Item Management, Categories)
only appears when inside `/store`.

## Apollo Client Architecture

All GraphQL traffic flows through a single `ApolloClient` instance created in `ApolloWrapper.tsx`:

```
ApolloWrapper.tsx
  makeLink(onAuthError)
    ├── httpLink        → /api/graphql (HTTP POST for Q/M)
    ├── wsLink          → ws(s)://<host>/api/subscriptions (WebSocket for Sub)
    ├── splitLink       → routes by operation type: subscription → wsLink, else → httpLink
    ├── authLink        → SetContextLink: injects Authorization: Bearer <token> from localStorage
    └── authErrorLink   → ErrorLink: calls onAuthError() on network errors

SSR path (no window): ApolloLink.from([SSRMultipartLink, httpLink])
Browser path: ApolloLink.from([authLink, authErrorLink, splitLink])
```

**Critical constraint:** Never create a second `ApolloClient`. The single instance is provided by
`ApolloNextAppProvider`.

## Real-Time Data Pattern

Components use `subscribeToMore` (not `useSubscription`) to receive live updates:

```typescript
const { data, subscribeToMore } = useQuery(getItemsQuery)

useEffect(() => {
  subscribeToMore({
    document: itemsSubscription,
    updateQuery: (prev, { subscriptionData }) => {
      const update = subscriptionData.data.getItemUpdates
      const filtered = prev.getItems.filter(i => i.id !== update.item.id)
      if (update.type === 'DELETED') return { ...prev, getItems: filtered }
      return { ...prev, getItems: [update.item, ...filtered] }  // upsert at head
    }
  })
}, [])
```

This pattern keeps the Apollo cache authoritative — subscription events update the same cache entry the query populated.

## Authentication Flow

```
/auth/page.tsx LoginPage
  → POST /api/login {"username","password"}
  → localStorage.setItem("token", jwt)
  → localStorage.setItem("username", user)
  → router.push("/")

ApolloWrapper SetContextLink
  → reads localStorage.getItem("token") on every request
  → injects Authorization: Bearer header

Logout.tsx
  → localStorage.removeItem("token")
  → router.push("/auth")
```

Network errors from Apollo trigger `onAuthError()` → redirects to `/auth`.

## GraphQL Operations

All operations are defined in `src/lib/<entity>/Queries.tsx` and scanned by graphql-codegen.

| File                       | Operations                                                                          |
|----------------------------|-------------------------------------------------------------------------------------|
| `lib/item/Queries.tsx`     | `getItems`, `saveItem`, `deleteItem`, `ItemUpdates` (subscription)                  |
| `lib/category/Queries.tsx` | `getCategories`, `saveCategory`, `deleteCategory`, `CategoryUpdates` (subscription) |

Generated types live in `src/__generated__/graphql.ts` — never edit manually. Regenerate with `npm run generate` (
requires backend running on `:2080` with valid JWT in `codegen.ts`).

## State Management

- **Server data:** Apollo InMemoryCache (source of truth for all GraphQL data)
- **Local UI state:** React `useState` (form values, dialog open state, filter/search)
- **Sorted/filtered lists:** Immutable.js `List` — used in `ItemsList.tsx` and category pages for sort + filter chains

```typescript
const items = List(itemsData?.getItems || [])
  .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  .filter(item => /* checked filter */)
  .filter(item => /* search filter */)
```

## Component Inventory Summary

See [component-inventory-bp_front.md](./component-inventory-bp_front.md) for the full inventory.

Key components:

| Component        | Type           | Purpose                                                      |
|------------------|----------------|--------------------------------------------------------------|
| `ApolloWrapper`  | Infrastructure | Apollo client setup and JWT injection                        |
| `AppHeader`      | Layout         | AppBar with title and navigation                             |
| `Navigation`     | Navigation     | Hamburger dropdown menu                                      |
| `ItemsList`      | Data + Display | Fetches items + categories, renders list grouped by category |
| `ItemView`       | Interactive    | Checkbox row — inline mutation on check/uncheck              |
| `CreateItem`     | Form dialog    | Create / edit / delete item                                  |
| `CreateCategory` | Form dialog    | Create / edit / delete category                              |
| `SelectCategory` | Form element   | Category dropdown for item forms                             |
| `LoginPage`      | Auth           | Username/password form with REST login                       |
| `Logout`         | Auth           | Clears token and redirects                                   |

## Styling Conventions

- All styling via MUI `sx` prop — no CSS modules, no `style={{}}`, no inline `<style>`
- Custom theme defined in `src/app/theme.ts` and applied in root layout
- MUI v9 API — always consult `mcp__mui-mcp__fetchDocs` / `mcp__mui-mcp__useMuiDocs` before writing components

## TypeScript Conventions

- `strict: true` — no `any`, no implicit nulls
- Path alias `@/*` → `src/*` — always use `@/` imports
- `moduleResolution: bundler` — Next.js bundler resolution
- `"use client"` required on any component using hooks, browser APIs, or event handlers

## Known Issues / Tech Debt

- No frontend test framework is settled (TBD)
- `bp_front/issues.md` contains in-progress notes
- `category` field on `GqlItem` is `String` instead of `ID` scalar — inconsistency with item `id`
