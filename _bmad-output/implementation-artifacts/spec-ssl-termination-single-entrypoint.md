---
title: 'Single served entrypoint behind an external SSL/domain edge proxy'
type: 'chore'
created: '2026-07-16'
status: 'done'
baseline_commit: '61178173bb4fb303b6d7f7b3843635f5280d9dae'
review_loop_iteration: 0
context:
  - '{project-root}/CLAUDE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** An external service (a same-host edge reverse proxy / PaaS) will terminate TLS and provide the domain, forwarding plain HTTP to the stack. Today the compose stack publishes **three** host ports — Caddy (`127.0.0.1:2080`), `bp_back` (`0.0.0.0:4000`) and `mongo` (`0.0.0.0:27217`) — so the backend and database are reachable off-host, bypassing the intended single entrypoint. Additionally, Caddy discards incoming `X-Forwarded-*` (anti-spoofing default), so once a second proxy hop is added the real client IP and `https` scheme are lost, collapsing the auth rate limiter to one global bucket.

**Approach:** Make the Caddy-served frontend (`127.0.0.1:2080`) the single entrypoint the edge proxy consumes; restrict `bp_back` and `mongo` published ports to loopback (host-side dev access only, never off-host); teach Caddy to trust the edge proxy so real client IP and scheme propagate to the backend; document the edge-proxy integration contract. No application/auth code behavior changes.

## Boundaries & Constraints

**Always:** Keep exactly one entrypoint the edge proxy serves (`127.0.0.1:2080` → Caddy). Preserve local-dev reachability: Vite dev proxy hits `localhost:4000`, local non-docker backend hits mongo at `localhost:27217` — loopback binds keep both working. Caddy reaches `bp_back:4000` over the compose network (unaffected by host-port binds). Trust only private/loopback ranges as proxies.

**Ask First:** Adding any new service/container to compose; changing the entrypoint port number; publishing any port on `0.0.0.0`; touching auth/cookie/JWT logic.

**Never:** Do not add TLS/cert config to Caddy (SSL is terminated externally). Do not introduce a cloudflared/tunnel sidecar (out of scope — chosen integration is same-host edge proxy). Do not remove the `bp_back`/`mongo` host ports entirely. Do not change refresh-cookie flags, CORS, or the `:2080` HTTP contract.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Served request | Edge proxy forwards HTTPS request as HTTP to `127.0.0.1:2080` with `X-Forwarded-For/Proto` set | Caddy serves SPA / proxies `/api`; backend `origin.remoteHost` = real client, scheme = `https` | N/A |
| WebSocket | `/api/subscriptions` upgrade through edge proxy → Caddy | Upgraded and proxied to `bp_back:4000` | N/A |
| Off-host backend probe | Remote host dials `<host>:4000` | Connection refused (bound to `127.0.0.1`) | N/A |
| Off-host DB probe | Remote host dials `<host>:27217` | Connection refused (bound to `127.0.0.1`) | N/A |
| Spoof attempt | Untrusted client sends forged `X-Forwarded-For` directly | Ignored — only private/loopback proxies are trusted | Header overwritten by Caddy |

</frozen-after-approval>

## Code Map

- `docker-compose.yaml` -- publishes the three host ports; `bp_front` already `127.0.0.1:2080:80`; `bp_back` and `mongo` publish on all interfaces (to fix)
- `routing/Caddyfile` -- single-entrypoint site block on `:80`; needs `trusted_proxies` so the extra hop's client IP/scheme survive
- `bp_back/.../plugins/ForwardedHeaders.kt` -- installs `XForwardedHeaders`; comment references nginx (stale)
- `bp_back/.../plugins/RateLimiting.kt` -- keys the `auth` limiter on `origin.remoteHost`; comment references nginx (stale)
- `bp_back/.../features/auth/AuthRoutes.kt` -- refresh cookie already `Secure`+`SameSite=Strict` (needs HTTPS) — read-only reference, do not change

## Tasks & Acceptance

**Execution:**
- [x] `docker-compose.yaml` -- change `bp_back` port mapping to `127.0.0.1:4000:4000` and `mongo` to `127.0.0.1:27217:27017`; leave `bp_front` as-is (`127.0.0.1:2080:80`) -- keeps loopback dev access while removing off-host exposure
- [x] `routing/Caddyfile` -- add a global options block with `servers { trusted_proxies static private_ranges }` above the site block -- makes Caddy honor the edge proxy's `X-Forwarded-*` so real client IP + `https` scheme reach the backend
- [x] `bp_back/.../plugins/ForwardedHeaders.kt` & `bp_back/.../plugins/RateLimiting.kt` -- update the stale nginx comments to describe the edge-proxy → Caddy (`trusted_proxies`) → backend `X-Forwarded-For` chain -- comment-only; keep code unchanged
- [x] `routing/edge-proxy.md` -- new doc: the integration contract the external edge proxy must satisfy -- upstream `http://127.0.0.1:2080`, must set `X-Forwarded-For`/`X-Forwarded-Proto: https`/`X-Forwarded-Host`, must support WebSocket upgrade for `/api/subscriptions`, TLS/domain owned externally

**Acceptance Criteria:**
- Given the stack is up, when `ss -tlnp` (or `docker compose ps`) is inspected, then `4000` and `27217` are bound to `127.0.0.1` only and `2080` is the sole loopback entrypoint the edge proxy targets.
- Given `npm run dev` locally, when the Vite dev proxy forwards `/api` to `localhost:4000`, then the app still functions (loopback bind unaffected).
- Given a request arrives via the edge proxy carrying `X-Forwarded-For`, when it reaches `bp_back`, then `call.request.origin.remoteHost` is the real client IP (not the edge proxy / docker gateway), so the auth rate limiter buckets per client.

## Verification

**Commands:**
- `docker compose config` -- expected: valid, `bp_back`/`mongo` show `127.0.0.1` host IP, `bp_front` shows `127.0.0.1:2080`
- `docker run --rm -v "$PWD/routing/Caddyfile:/etc/caddy/Caddyfile" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` -- expected: "Valid configuration"
- `docker compose up --build -d && ss -tlnp | grep -E ':(2080|4000|27217)'` -- expected: all three on `127.0.0.1`, none on `0.0.0.0`

**Manual checks:**
- Confirm no compose service publishes on `0.0.0.0`; the edge proxy (same host) can reach `127.0.0.1:2080` while `4000`/`27217` are unreachable from another machine.

## Suggested Review Order

**Design intent (start here)**

- The whole model in one page: single entrypoint + what the external edge proxy must satisfy.
  [`edge-proxy.md:9`](../../routing/edge-proxy.md#L9)

**Single served entrypoint (port surface)**

- Backend restricted to loopback — no longer a second off-host entrypoint bypassing Caddy.
  [`docker-compose.yaml:49`](../../docker-compose.yaml#L49)

- Mongo restricted to loopback — database no longer reachable off-host.
  [`docker-compose.yaml:11`](../../docker-compose.yaml#L11)

- Unchanged, and now the sole served entrypoint the edge proxy targets.
  [`docker-compose.yaml:33`](../../docker-compose.yaml#L33)

**Client-IP propagation through the added proxy hop**

- The load-bearing fix: Caddy trusts the edge proxy so the real client IP survives the extra hop.
  [`Caddyfile:17`](../../routing/Caddyfile#L17)

- Why it matters: the auth rate limiter keys on that client IP.
  [`RateLimiting.kt:20`](../../bp_back/src/main/kotlin/com/bagplease/plugins/RateLimiting.kt#L20)

- The only forwarded-header consumer; documents the edge-must-overwrite-XFF requirement.
  [`ForwardedHeaders.kt:13`](../../bp_back/src/main/kotlin/com/bagplease/plugins/ForwardedHeaders.kt#L13)

**Contract precision (post-review patch)**

- Explicit overwrite-not-append rule for X-Forwarded-For + trust caveat (from adversarial review).
  [`edge-proxy.md:27`](../../routing/edge-proxy.md#L27)
