# Architecture — routing (Caddy)

## Summary

The `routing/` part is just a **`Caddyfile`** — there is no standalone routing image or `router` service. The Caddyfile
is baked into the **`bp_front`** multi-stage image (`bp_front/Dockerfile`): stage 1 builds the Vite SPA, stage 2
(`caddy:2-alpine`) serves the built bundle from `/srv` and proxies `/api` to the backend. Caddy unifies frontend and
backend behind a single port — `:80` inside the container, published as `127.0.0.1:2080` on the host. It handles both
HTTP and WebSocket traffic.

TLS and the public domain are **not** handled here — an external edge proxy on the host terminates HTTPS (e.g.
`https://bag-please.localhost`) and forwards plain HTTP to Caddy on `:2080`. See `routing/edge-proxy.md`.

> This part was previously nginx + a separate `router` service proxying to a Next.js dev server on `:3000`. That is
> gone:
> the stack is now Vite + Caddy, with Caddy living inside the `bp_front` image.

## Routing rules (`routing/Caddyfile`)

`handle` blocks are mutually exclusive and evaluated in source order, so the WebSocket route is matched before the
generic `/api/*` rule.

| Pattern              | Protocol  | Target          | Notes                                                              |
|----------------------|-----------|-----------------|--------------------------------------------------------------------|
| `/api/subscriptions` | WebSocket | `bp_back:4000`  | GraphQL subscriptions (graphql-ws); matched first                  |
| `/api/*`             | HTTP      | `bp_back:4000`  | All backend HTTP, incl. `/api/graphql`, `/api/auth/*`              |
| everything else      | HTTP      | `/srv` (static) | Built SPA; `try_files {path} /index.html` (SPA deep-link fallback) |

Caddy's `reverse_proxy` upgrades WebSockets automatically — no extra directives are needed.

## Trusted proxies / forwarded headers

```caddyfile
{
	servers {
		trusted_proxies static private_ranges
	}
}
```

Caddy ignores incoming `X-Forwarded-*` by default (anti-spoofing). Trusting `private_ranges` lets the edge proxy's
`X-Forwarded-For` (the real client IP) reach `bp_back`, where the auth rate limiter keys on it. **Caveat:** this trusts
the entire RFC1918 + loopback range — any local process reaching `:2080` is trusted too. Because the entrypoint is bound
to `127.0.0.1`, practical exposure is limited to other processes on the same host. See `routing/edge-proxy.md` for the
full contract (including that the edge must *overwrite*, not append, `X-Forwarded-For`).

## Port map

```
browser --HTTPS--> edge proxy (TLS, https://bag-please.localhost) --HTTP--> Caddy 127.0.0.1:2080
                                                                              |
                                                                              +--> /api/*  -> bp_back:4000
                                                                              +--> else    -> SPA (/srv)
```

`bp_back` (`:4000`) and `mongo` (`:27217`) are bound to `127.0.0.1` for local tooling and are not the served
entrypoint — the only serving port is Caddy on `:2080`.

## Docker Compose configuration

There is no `router` service. Caddy ships as part of `bp_front`:

```yaml
bp_front:
  build:
    context: .                       # repo root — so the Dockerfile can COPY routing/Caddyfile
    dockerfile: bp_front/Dockerfile
  ports:
    - "127.0.0.1:2080:80"            # only reachable from localhost / the host edge proxy
  depends_on:
    mongo: { condition: service_healthy }
    bp_back: { condition: service_started }
```

## Local dev has no Caddy

The Caddy routing layer only runs in the built stack. For inner-loop development the **Vite dev server** (`:5173`) does
the proxying instead — `bp_front/vite.config.ts` forwards `/api` to `http://localhost:4000` and `/api/subscriptions` to
`ws://localhost:4000`. So there is nothing to switch between "dev" and "containerized" routing configs — dev uses Vite's
proxy, the built image uses Caddy.
