# Tech Dept
## Backend
1. Migrate from jackson to kotlinx.serialization
2. Migrate from java UUID to kotlinx.UUID
3. Dependency creation is looking bulk, refactor by extracting dependency creation in services (for instance)
4. EntityStore layer will lead to OOM error, refactor by using LRU cache.
5. Do not pass config values one-by-one in service constructor, use a config object instead.
6. Cover the project with logs, respect log levels and avoid excessive logging.
7. Setup cors protection

## Frontend
1. Create and update favicon
2. Replace next.js with vite, using modern webserver to serve files, and remove router necessity
3. Improve gql generation flow, from generation to typed usage.


## AI
1. Introduce gradle mcp
