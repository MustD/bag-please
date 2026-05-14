---
name: Ktor ContentNegotiation wiring rule
description: ContentNegotiation must stay Route-level (not Application-level) in bag-please backend due to graphql-kotlin
type: feedback
---

Do NOT install ContentNegotiation at the Application level in `configureSecurity()` or `Application.module()`.

**Why:** `graphql-kotlin-ktor-server` also installs ContentNegotiation at its route scope. Moving it to Application
level triggers `DuplicatePluginException: Installing RouteScopedPlugin to application and route is not supported`.
Additionally, when multiple `routing {}` blocks share the same root node `/`, installing ContentNegotiation in both
`securityRoutes()` and `configureAuthRoutes()` also throws
`DuplicatePluginException: Plugin ContentNegotiation is already installed to the pipeline /`.

**How to apply:** Install ContentNegotiation exactly once — in `securityRoutes()` (called by `configureRouting()`). New
routing blocks added via separate `Application` extensions (e.g., `configureAuthRoutes()`) must NOT install
ContentNegotiation again; they inherit it from the shared routing tree root.
