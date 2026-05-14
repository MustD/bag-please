---
name: testApplication does not auto-load application.yaml
description: Ktor testApplication starts with empty MapApplicationConfig; setUpJwt() is still needed in all tests
type: feedback
---

Always call `setUpJwt()` in new backend tests even after creating `src/test/resources/application.yaml`.

**Why:** Ktor's `testApplication {}` starts with a minimal `MapApplicationConfig`, not a YAML-loaded config. The
`src/test/resources/application.yaml` file exists on the classpath but is NOT auto-loaded by `testApplication`. Without
`setUpJwt()`, `module()` fails at `config.property("jwt.admin_login")` with
`ApplicationConfigurationException: Property jwt.admin_login not found`.

**How to apply:** Every new `testApplication { }` block that calls `application { module() }` must also call
`setUpJwt()` (for JWT config) and `setUpMongo(container)` (for MongoDB config) before the `application { }` call.
