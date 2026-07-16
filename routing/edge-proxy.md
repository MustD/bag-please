# External edge proxy — integration contract

TLS termination and the public domain for Bag Please are owned by an **external
edge proxy that runs on the same host** (e.g. a reverse proxy or PaaS such as
Traefik, Caddy, nginx-proxy, Coolify). This repo does **not** manage certificates
or the domain — it only exposes a single plain-HTTP entrypoint for that proxy to
consume.

## The single served entrypoint

The whole stack is served through exactly one host port:

```
http://127.0.0.1:2080   ->  bp_front (Caddy)  ->  SPA + /api + /api/subscriptions
```

`docker-compose.yaml` publishes only this port for serving. `bp_back` (`:4000`)
and `mongo` (`:27217`) are bound to `127.0.0.1` for local development and are
**not** reachable from other machines — the edge proxy must never target them.

## What the edge proxy must do

1. **Upstream** — forward all traffic to `http://127.0.0.1:2080`. Do not route
   `/api` separately; Caddy already splits SPA, `/api/*`, and the
   `/api/subscriptions` WebSocket internally.
2. **Forwarded headers** — on every proxied request:
   - **`X-Forwarded-For` (load-bearing) — must be _overwritten_ with the real
     client IP, not appended.** The backend keys the auth rate limiter on the
     **first** value of this header (Ktor `XForwardedHeaders` default). If the edge
     *appends* to a client-supplied `X-Forwarded-For` (e.g. nginx's
     `$proxy_add_x_forwarded_for`), a caller can forge the leftmost value and
     spoof their IP — defeating rate limiting. Set it to the client IP only
     (nginx: `proxy_set_header X-Forwarded-For $remote_addr`). If the edge omits it
     entirely, rate limiting degrades to one global bucket for all clients.
   - `X-Forwarded-Proto: https` and `X-Forwarded-Host: <public domain>` —
     recommended for correctness and future use, but **not currently consumed** by
     this backend (the refresh cookie is issued `Secure` unconditionally; no code
     reads the forwarded scheme or host).

   Caddy is configured with `trusted_proxies static private_ranges` (see
   `Caddyfile`) so it preserves these headers from the edge instead of replacing
   them.

   > **Trust caveat:** `private_ranges` trusts the entire RFC1918 + loopback
   > range, not just the edge proxy. Because the entrypoint is bound to
   > `127.0.0.1`, the practical exposure is limited to *other processes on the
   > same host* — any of them can reach `:2080` and, appearing as the Docker
   > gateway, be trusted to set forwarded headers. On a shared/multi-tenant host,
   > pin `trusted_proxies` to the exact Docker bridge gateway CIDR instead.
3. **WebSocket upgrade** — proxy `Upgrade`/`Connection` headers so
   `/api/subscriptions` (graphql-ws) works. Most proxies do this by default.
4. **TLS** — terminate HTTPS at the edge and serve the public domain. The refresh
   cookie is issued `Secure` + `SameSite=Strict`, so the browser-facing origin
   **must** be HTTPS or authentication will not persist.

## Request chain

```
browser  --HTTPS-->  edge proxy (TLS, domain)  --HTTP-->  Caddy :2080  -->  bp_back :4000
                                                              |
                                                              +-->  SPA (/srv)
```
