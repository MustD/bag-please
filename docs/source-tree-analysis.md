# Source Tree Analysis

## Repository Root

```
bag-please/                         # Repo root — also the Gradle root project
├── bp_back/                        # [PART] Kotlin/Ktor backend
├── bp_front/                       # [PART] Next.js/React frontend
├── routing/                        # [PART] nginx reverse proxy config + Dockerfile
├── db/                             # MongoDB data volume (gitignored data/)
├── ApiPlayground/                  # IntelliJ HTTP Client .http files
│   ├── security/                   # Login / auth-test requests
│   ├── item/                       # Item CRUD requests
│   └── category/                   # Category CRUD requests
├── documentation/                  # Manual documentation assets
│   └── bag-please.drawio           # Architecture diagram
├── gradle/
│   └── libs.versions.toml          # Shared Gradle version catalog
├── gradlew / gradlew.bat           # Gradle wrapper (used by bp_back)
├── settings.gradle.kts             # Gradle root settings
├── build.gradle.kts                # Gradle root build (minimal)
├── docker-compose.yaml             # Orchestrates all 4 services
├── project.env / project.example.env  # Environment variable templates
└── images-build-push.sh           # CI helper: build & push Docker images
```

## Part: bp_back (Backend)

```
bp_back/
├── build.gradle.kts                # Build config: Kotlin 2.3.21, JVM 25, Ktor plugin
├── gradle.properties               # Gradle JVM args
├── Dockerfile                      # Multi-stage build → JRE 25 slim image
└── src/
    ├── main/
    │   ├── kotlin/com/bagplease/
    │   │   ├── Application.kt      # ENTRY POINT — wires plugins + MongoConnection DI
    │   │   ├── Service.kt          # Thin ApplicationConfig wrapper (rarely used)
    │   │   ├── plugins/
    │   │   │   ├── GQL.kt          # GraphQL plugin: registers all entities, routes, WebSocket
    │   │   │   ├── Security.kt     # JWT auth plugin + POST /login route
    │   │   │   ├── Routing.kt      # Assembles securityRoutes() + gqlRoutes()
    │   │   │   ├── CORS.kt         # CORS plugin configuration
    │   │   │   └── Monitoring.kt   # Call logging plugin
    │   │   ├── mongo/
    │   │   │   ├── MongoConnection.kt   # Creates MongoClient + MongoDatabase from config
    │   │   │   └── model/serialization/
    │   │   │       └── UUIDSerializer.kt  # Custom BSON serializer for java.util.UUID
    │   │   ├── entity/
    │   │   │   ├── item/
    │   │   │   │   ├── Item.kt          # Domain model: id, name, checked, category (UUID FK)
    │   │   │   │   ├── ItemService.kt   # Business logic + SharedFlow update/delete channels
    │   │   │   │   ├── ItemStorage.kt   # ConcurrentMap cache + lazy MongoDB sync
    │   │   │   │   ├── gql/
    │   │   │   │   │   ├── ItemApi.kt         # ItemQueries / ItemMutations / ItemSubscriptions
    │   │   │   │   │   ├── GqlItem.kt         # GQL output type (@GraphQLName("Item"))
    │   │   │   │   │   ├── GqlItemUpdate.kt   # GQL subscription event type
    │   │   │   │   │   ├── GqlItemMapper.kt   # Maps Item ↔ GqlItem
    │   │   │   │   │   └── GqlItemUpdate.kt   # Subscription wrapper: type (SAVED|DELETED) + item
    │   │   │   │   └── mongo/
    │   │   │   │       ├── MongoItem.kt       # @Serializable BSON model with @SerialName("_id")
    │   │   │   │       ├── MongoItemMapper.kt # Maps Item ↔ MongoItem
    │   │   │   │       └── ItemRepository.kt  # MongoDB upsert/find/delete via coroutine driver
    │   │   │   └── category/
    │   │   │       ├── Category.kt        # Domain model: id, name
    │   │   │       ├── CategoryService.kt # Business logic + SharedFlow channels
    │   │   │       ├── CategoryStorage.kt # ConcurrentMap cache + lazy sync
    │   │   │       ├── gql/               # Mirror of item/gql/: CategoryApi, GqlCategory, mapper
    │   │   │       └── mongo/             # Mirror of item/mongo/: MongoCategory, mapper, repo
    │   │   └── storage/               # (Reserved — currently empty, shared storage utilities may go here)
    │   └── resources/
    │       ├── application.yaml       # Ktor config: port 4000, rootPath "api", JWT, MongoDB
    │       └── logback.xml            # Logback logging config
    └── test/
        ├── kotlin/com/bagplease/
        │   ├── ApplicationTest.kt     # Basic smoke test
        │   ├── AuthApiTest.kt         # Login / JWT validation tests
        │   ├── ItemApiTest.kt         # Item CRUD via GraphQL
        │   └── utils/
        │       └── TestContainers.kt  # mongoContainer() helper + setUpMongo() / setUpJwt()
        └── resources/                 # (Empty — test application.yaml may be added here)
```

## Part: bp_front (Frontend)

```
bp_front/
├── package.json                    # Dependencies: Next.js 16, React 19, Apollo Client 4, MUI 9
├── tsconfig.json                   # strict: true, moduleResolution: bundler, paths: @/* → src/*
├── next.config.mjs                 # output: "standalone" (for Docker)
├── codegen.ts / codegen.yml        # graphql-codegen config → generates src/__generated__/
├── .eslintrc.json                  # next/core-web-vitals rules
├── Dockerfile                      # Multi-stage: build → standalone Node runner
└── src/
    ├── __generated__/              # AUTO-GENERATED — do not edit; run `npm run generate`
    │   └── graphql.ts              # Typed hooks, operations, and fragments from schema
    ├── app/                        # Next.js App Router pages and layouts
    │   ├── layout.tsx              # ROOT LAYOUT — MUI ThemeProvider, AppHeader, CssBaseline
    │   ├── page.tsx                # Home redirect (/)
    │   ├── theme.ts                # MUI theme definition
    │   ├── AppHeader.tsx           # AppBar with app title + Navigation dropdown
    │   ├── Navigation.tsx          # Hamburger menu: Home, To Buy List, Item Mgmt, Categories, Logout
    │   ├── auth/
    │   │   ├── page.tsx            # Login form (POST /api/login, stores JWT in localStorage)
    │   │   ├── Logout.tsx          # Clears localStorage token + redirects to /auth
    │   │   └── layout.tsx          # Auth section layout (wraps ApolloWrapper)
    │   └── store/
    │       ├── page.tsx            # To Buy List main page (ItemsList + Create FAB)
    │       ├── layout.tsx          # Store section layout
    │       ├── Navigation.tsx      # In-store sub-navigation
    │       ├── ItemsList.tsx       # Item list: query + subscription + search + category filter
    │       ├── ItemView.tsx        # Single item row: checkbox (inline save mutation)
    │       ├── item/
    │       │   ├── page.tsx        # Item management page
    │       │   ├── layout.tsx
    │       │   └── CreateItem.tsx  # Dialog: create/edit/delete item with category picker
    │       └── category/
    │           ├── page.tsx        # Category management table with search
    │           ├── layout.tsx
    │           ├── CreateCategory.tsx   # Dialog: create/edit/delete category
    │           └── SelectCategory.tsx   # Dropdown selector for item forms
    └── lib/                        # GraphQL operations (scanned by codegen)
        ├── apollo/
        │   └── ApolloWrapper.tsx   # Apollo client: HTTP + WebSocket split link, JWT injection
        ├── item/
        │   └── Queries.tsx         # getItems, saveItem, deleteItem, itemsSubscription
        └── category/
            └── Queries.tsx         # getCategories, saveCategory, deleteCategory, categoriesSubscription
```

## Part: routing (nginx)

```
routing/
├── nginx.conf      # Reverse proxy: port 80 → proxies to backend :4000 and frontend :3000
└── Dockerfile      # FROM nginx:alpine + COPY nginx.conf
```

## Critical Path Summary

| Purpose | Path |
|---------|------|
| Backend entry point | `bp_back/src/main/kotlin/com/bagplease/Application.kt` |
| Plugin registration | `bp_back/src/main/kotlin/com/bagplease/plugins/GQL.kt` |
| GraphQL routes | `plugins/GQL.kt → gqlRoutes()` |
| Auth route | `plugins/Security.kt → securityRoutes()` |
| Frontend entry point | `bp_front/src/app/layout.tsx` |
| Apollo client setup | `bp_front/src/lib/apollo/ApolloWrapper.tsx` |
| All GQL operations | `bp_front/src/lib/*/Queries.tsx` |
| Generated GQL types | `bp_front/src/__generated__/graphql.ts` |
| nginx config | `routing/nginx.conf` |
| Orchestration | `docker-compose.yaml` |
