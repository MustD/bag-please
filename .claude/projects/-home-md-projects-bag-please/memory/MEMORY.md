# Memory Index

- [Login endpoint is /api/auth/login](feedback_login_endpoint.md) — Not /api/login as docs say; correct path confirmed
  from backend routing
- [Ktor ContentNegotiation wiring gotcha](feedback_ktor_contentnegotiation.md) — Route-level plugin rule for bag-please
  backend
- [MongoDB UUID filter for users](feedback_mongo_uuid_filter.md) — Use UUID object (not toString()) in Filters.eq for _
  id
- [testApplication config loading](feedback_testapplication_yaml.md) — testApplication does not auto-load YAML;
  setUpJwt() still required
- [Epic 2 architectural decisions](project_epic2_arch_decisions.md) — No UserStorage, GraphQL for admin ops,
  ApplicationConfig direct to MongoDB
