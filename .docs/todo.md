# TODO

- [ ] Initialize monorepo scaffold (apps/frontend with Vite + React + JS, apps/backend with FastAPI, shared config, root docker-compose.yml/prod override).
- [ ] Stand up local infra: Dockerized PostgreSQL (self-hosted) with tuned config + Alembic migrations; Redis for sessions/rate limit/WebSocket pub-sub; nginx reverse proxy.
- [ ] Implement Module A (Banking Core): auth, dashboard, transfers (IMPS/NEFT simulation), bill pay, profile/KYC, beneficiaries, ledger receipts; RBAC and limits enforced server-side.
- [ ] Implement Module B (Agent): voice orb overlay, WS audio streaming, Deepgram STT, Groq LLM with tool calls, ElevenLabs TTS, DOM action executor with guardrails and barge-in logic.
- [ ] Observability & prod hardening: structured JSON logs, health checks, Prometheus/Grafana exporters, backups (pg_dump + WAL), CI/CD (lint/test/build/deploy, run migrations), security headers/rate limits.
