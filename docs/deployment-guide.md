# Deployment Guide

## Services

| Service    | Image                                             | Port                | Notes                                  |
|------------|---------------------------------------------------|---------------------|----------------------------------------|
| `router`   | Built from `routing/`                             | `127.0.0.1:2080:80` | nginx — entry point                    |
| `mongo`    | `mongo:8`                                         | `27017:27017`       | Persistent volume at `./db/data`       |
| `bp_back`  | Built from `.` (Dockerfile: `bp_back/Dockerfile`) | `4000:4000`         | Waits for mongo healthy                |
| `bp_front` | Built from `bp_front/`                            | `3000:3000`         | Waits for mongo healthy + back started |

## Docker Compose — Full Stack

```bash
# Build and start all services
docker compose up --build

# Start only infrastructure (for local dev)
docker compose up mongo router

# Stop and remove containers
docker compose down

# Stop and remove containers + volumes (wipes MongoDB data)
docker compose down -v
```

## Environment Variables

Create `project.env` (copy from `project.example.env`) to override defaults:

| Variable             | Default                                   | Service |
|----------------------|-------------------------------------------|---------|
| `KTOR_MONGO_HOST`    | `mongo` (in Docker) / `localhost` (local) | bp_back |
| `KTOR_MONGO_PORT`    | `27017`                                   | bp_back |
| `KTOR_MONGO_DB_NAME` | `bag_please`                              | bp_back |
| `KTOR_MONGO_USER`    | `user`                                    | bp_back |
| `KTOR_MONGO_PASS`    | `pass`                                    | bp_back |
| `KTOR_JWT_SECRET`    | `secret`                                  | bp_back |
| `KTOR_ADMIN_LOGIN`   | `admin`                                   | bp_back |
| `KTOR_ADMIN_PASS`    | `admin`                                   | bp_back |

**Production:** Always override `KTOR_JWT_SECRET`, `KTOR_ADMIN_LOGIN`, `KTOR_ADMIN_PASS`, and MongoDB credentials.

## Dockerfiles

### bp_back (`bp_back/Dockerfile`)

Multi-stage Gradle build. Build context is the **repo root** (not `bp_back/`) because the Gradle wrapper and version
catalog live at the root.

```yaml
# In docker-compose.yaml:
bp_back:
  build:
    context: .                     # repo root
    dockerfile: bp_back/Dockerfile
```

### bp_front (`bp_front/Dockerfile`)

Multi-stage Next.js build using `output: "standalone"` — produces a self-contained Node.js server.

### routing (`routing/Dockerfile`)

```dockerfile
FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
```

## Health Check

MongoDB has a built-in health check:

```yaml
healthcheck:
  test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping').ok"]
  interval: 10s / timeout: 5s / retries: 5 / start_period: 20s
```

`bp_back` and `bp_front` depend on `mongo: condition: service_healthy`.

**No backend health endpoint exists** — the app starts up and immediately accepts connections on port 4000. Use
`http://localhost:2080/api/graphiql` loading as a manual readiness check.

## Building and Pushing Docker Images

The `images-build-push.sh` script automates multi-arch image builds and pushes. Review its contents before use.

## MongoDB Persistence

Data directory is mounted as `./db/data:/data/db`. The `db/.gitignore` excludes the data files. Back up this directory
for data persistence across container recreations.

## Production Hardening Checklist

- [ ] Set strong `KTOR_JWT_SECRET` (min 32 chars, random)
- [ ] Change `KTOR_ADMIN_LOGIN` and `KTOR_ADMIN_PASS` from defaults
- [ ] Change MongoDB `MONGO_INITDB_ROOT_USERNAME` / `MONGO_INITDB_ROOT_PASSWORD`
- [ ] nginx port binding: currently `127.0.0.1:2080` — remove IP restriction or add TLS termination for internet
  exposure
- [ ] Add TLS (nginx handles termination — update nginx.conf and cert paths)
- [ ] Back up `./db/data` regularly
- [ ] Consider rotating JWT secret and invalidating existing tokens

## Known GLIBC Issue (MongoDB on Kernel ≥ 6.19)

```yaml
mongo:
  environment:
    GLIBC_TUNABLES: "glibc:pthread:rseq=1"
```

This workaround is required on Linux hosts with kernel ≥ 6.19.
