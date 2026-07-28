# CLAUDE.md — Frontend (`bp_front/`)

Guidance for working in the Vite + React 19 SPA. Build/dev/codegen/E2E commands live in the root `CLAUDE.md`.

## Frontend

Vite + React 19 single-page app (App entry `src/main.tsx` → `src/App.tsx`). Apollo Client handles all GraphQL
communication via a single split link (`src/lib/apollo/ApolloProvider.tsx`): HTTP for queries/mutations
(`/api/graphql`), WebSocket (`graphql-ws`) for subscriptions (`/api/subscriptions`), with the access token supplied in
`connectionParams`. Never instantiate a second Apollo or `graphql-ws` client.

Auth is **in-memory only** (`src/lib/auth/AuthContext.tsx`) — the access token lives in React state/context, never in
`localStorage`. On load the provider attempts a silent `POST /api/auth/refresh` (httpOnly cookie) to bootstrap a
session. Apollo's error link retries one silent refresh on HTTP 401, then clears auth and redirects to
`/auth?expired=1`.

Routing is client-side via React Router (declarative `<BrowserRouter>`/`<Routes>`). `src/routes/RouteGuard.tsx` is the
auth guard (redirects unauthenticated users to `/auth` with `replace`); `src/routes/AdminGuard.tsx` guards `/admin/*`.

A single **dark** MUI theme (`src/theme.ts`, `createTheme({ palette: { mode: 'dark' }})`) is applied app-wide via
`ThemeProvider` + `CssBaseline`. Style with the theme + `sx` only. The `src/__generated__/` directory is auto-generated
by `graphql-codegen` — do not edit manually.

UI components are built with **Material UI (MUI)**. When working on frontend UI, use the `mcp__mui-mcp__fetchDocs` /
`mcp__mui-mcp__useMuiDocs` MCP tools to look up MUI component APIs and usage before writing or editing components.

## GraphQL schema management

`codegen.ts` points at `http://localhost:2080/api/graphql` and reads the admin Bearer token from `CODEGEN_TOKEN`
(access tokens are short-lived, so mint a fresh one at run time — see the `npm run generate` command in the root
`CLAUDE.md`). The generated output goes to `bp_front/src/__generated__/`.

`ApiPlayground/` contains `.http` files for manually exercising the API via IntelliJ HTTP Client.
