# Backend Specification (FastAPI)

## API Standards
- REST over HTTPS, JSON snake_case, JWT bearer in Authorization header.
- Versioned prefix `/api/v1`.

## Core Endpoints (sample)
- `POST /api/v1/auth/login` -> JWT
- `GET /api/v1/me` -> profile + KYC status
- `GET /api/v1/accounts` -> balances
- `GET /api/v1/ledger?limit=5` -> last transactions
- `POST /api/v1/transfers` (beneficiary_id, amount, mode=IMPS|NEFT) with server-side limit checks
- `GET /api/v1/bills` -> categories; `POST /api/v1/bills/pay`
- `GET/POST /api/v1/beneficiaries`
- `GET /api/v1/audit-logs` (admin)

## WebSocket Protocol
- Endpoint: `/ws/agent/v1?auth_token=...`
- Client events: `AUDIO_CHUNK` (binary), `CONTEXT_UPDATE` (JSON with url, aria_ids, locale).
- Server commands: `ACTION_DISPATCH` (JSON plan), `AGENT_SPEAK` (TTS payload/URL), `STOP_AUDIO` (on barge-in).

## Data Model (PostgreSQL)
- users: id, phone/email, role (USER/ADMIN), voice_print_id, pii_encrypted, created_at
- accounts: id, user_id FK, type (SAVINGS|CURRENT), balance_cents, status
- ledger: id, account_id, amount_cents (+/-), counterparty, narration, created_at (immutable)
- beneficiaries: id, user_id, nickname, name, account_number, ifsc, created_at
- audit_logs: id, user_id, command_text, action_json, result, created_at

## Services
- Auth: JWT mint/verify, RBAC, rate limits.
- Banking: balance/ledger, transfer simulation, bill pay stub.
- Agent Orchestrator: manages LLM context + tool definitions, enforces limits, sanitizes form values, builds action plans.
- AI Integrations: Deepgram STT (stream), Groq LLM (tool calls), ElevenLabs TTS (stream or URL).

## Cross-Cutting
- Config via pydantic-settings; env-specific .env files.
- Logging: structured JSON (loguru), request/response ids; redact PII.
- Validation: Pydantic schemas; sanitize any LLM-proposed form input.
- Health: `/health` checks DB, Redis, upstream AI reachability.

## Migrations
- Alembic with autogenerate; reviewed before apply.
- scripts: `wait-for-it.sh`, `run-migrations.sh` run on deploy.
