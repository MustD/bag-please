---
name: feedback_login_endpoint
description: The backend login endpoint is /api/auth/login, not /api/login as stated in some docs
metadata:
  type: feedback
---

The correct login endpoint through nginx is `POST /api/auth/login` with `{"username":"admin","password":"admin"}`. The
CLAUDE.md and project-context.md say `/api/login` which is wrong — the backend registers the route at `/auth/login`
which nginx exposes as `/api/auth/login`.

**Why:** Discovered during Story 4.7 when refreshing the JWT for codegen — `/api/login` returned 404, checked backend
routing trace to find the real path.

**How to apply:** Always use `/api/auth/login` for obtaining JWTs, including codegen token refreshes and API playground
auth calls. Update codegen instructions if asked.
