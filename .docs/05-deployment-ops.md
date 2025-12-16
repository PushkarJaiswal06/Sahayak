# Deployment & Ops

## Environments
- dev: docker-compose with hot reload, local Postgres/Redis.
- prod: docker-compose.prod (no volumes, resource limits, restart always, logging drivers), nginx reverse proxy, self-hosted Postgres + Redis.

## Docker Compose (shape)
- Services: frontend (nginx static), backend (uvicorn), postgres, redis, nginx reverse proxy.
- Healthchecks: pg_isready; redis ping; backend `/health`; nginx HTTP check.

## Config & Secrets
- `.env.example` committed; `.env.development`, `.env.staging`, `.env.production` gitignored.
- Prefer Docker secrets for prod; never commit creds.

## CI/CD (GitHub Actions suggested)
- CI: lint/test/build for frontend (ESLint/Prettier) and backend (flake8/mypy/pytest) with service containers for Postgres/Redis.
- CD: on main -> build & push images, pull on server, `docker-compose -f docker-compose.prod.yml up -d`, run Alembic migrations, smoke health check.

## Observability
- Metrics: prometheus-fastapi-instrumentator, postgres-exporter, redis-exporter, node-exporter.
- Dashboards: Grafana (app latencies, error rates, DB/Redis health, WS success rate, business KPIs).
- Logs: JSON to stdout; optional Loki/ELK sink; redact PII.

## Backups & DR
- Nightly `pg_dump` + WAL archiving to object storage; 30-day retention; restore drills.

## Security
- TLS at nginx; security headers; rate limiting at nginx; CORS restricted.
- Server-side limits for transactions regardless of client state; audit logs for all agent actions.
