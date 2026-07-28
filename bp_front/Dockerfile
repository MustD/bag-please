# Multi-stage frontend image: build the Vite SPA, then serve it with Caddy.
# This is the production artifact the E2E suite runs against (production parity).
# Build context is the repo root (see docker-compose.yaml) so the serve stage
# can COPY the Caddyfile that lives under routing/.

# --- Stage 1: build the static bundle ---
FROM node:26-alpine AS build
WORKDIR /app
COPY bp_front/package.json bp_front/package-lock.json ./
RUN npm ci
COPY bp_front/ ./
RUN npm run build

# --- Stage 2: serve the bundle with Caddy ---
FROM caddy:2-alpine
COPY routing/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
