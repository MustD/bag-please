# Architecture — routing (nginx)

## Summary

The `routing` part is an nginx reverse proxy that unifies the backend (`:4000`) and frontend (`:3000`) behind a single
port (`:2080`/`:80` inside Docker). It handles both HTTP and WebSocket traffic.

## Routing Rules

| Pattern              | Protocol  | Target (dev mode)           | Notes                 |
|----------------------|-----------|-----------------------------|-----------------------|
| `/_next/webpack-hmr` | WebSocket | `host.docker.internal:3000` | Next.js HMR in dev    |
| `/api/subscriptions` | WebSocket | `host.docker.internal:4000` | GraphQL subscriptions |
| `/api/*`             | HTTP      | `host.docker.internal:4000` | All backend HTTP      |
| `/` (default)        | HTTP      | `host.docker.internal:3000` | Frontend              |

WebSocket locations require `proxy_http_version 1.1` + `Upgrade`/`Connection` headers.

## Port Map

```
Browser → localhost:2080 (nginx)
nginx   → localhost:4000 (Ktor backend, rootPath: "api")
nginx   → localhost:3000 (Next.js frontend)
```

## Dev vs Fully-Containerized Mode

**Dev mode (default):** nginx proxies to `host.docker.internal` — backend and frontend run locally, nginx runs in
Docker.

**Fully-containerized mode:** Uncomment `proxy_pass http://bp_back:4000` / `http://bp_front:3000` lines and comment out
`host.docker.internal` targets. This is not a one-command switch.

## Docker Compose Configuration

```yaml
router:
  build: { context: ./routing }
  ports: ["127.0.0.1:2080:80"]   # only accessible from localhost
  extra_hosts: ["host.docker.internal:host-gateway"]
```

The `extra_hosts` entry makes `host.docker.internal` resolve to the Docker host gateway — required for dev-mode
proxying.
