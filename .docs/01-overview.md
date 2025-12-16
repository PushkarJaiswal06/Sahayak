# Sahayak Master Context

## Mission
Voice-first, agentic banking platform for Hinglish users. Two modules: A) Banking Core SPA, B) Agentic overlay that perceives state, reasons, and executes UI actions safely.

## Pillars
- Trust & Safety: server-enforced limits, audit logs, PII encryption, guardrails before any high-value action.
- Accessibility: voice-first, ARIA anchors on all interactives, high-contrast UI, Hindi/English toggle.
- Reliability: self-hosted PostgreSQL, Redis-backed sessions/rate limiting, health checks, structured logs, backups.

## Roles
- End User (Ram Lal): voice-first, needs balance, last 5 txns, pay bills, send money.
- Administrator (Bank Manager): monitor system health, approve high-value txns, view audit/conversation logs.

## Functional Scope
- Dashboard: balance + recent activity.
- Transfers: IMPS/NEFT simulation, beneficiaries with nicknames, receipts.
- Bills: fetch/pay utility categories.
- Profile: KYC status, language, voice training toggle.
- Agent: wake word/tap-to-speak orb, navigation + form-filling agents, barge-in handling.

## Tech Stack (decided)
- Frontend: Vite + React + JavaScript, nginx for static serve + reverse proxy.
- Backend: FastAPI (Python 3.11), SQLAlchemy + Alembic.
- Data: Self-hosted PostgreSQL; Redis (sessions, rate limit, WS fan-out).
- AI: Deepgram Nova-2 (STT, streaming), Groq Llama 3 70B (LLM reasoning + tool calling), ElevenLabs Turbo v2 (TTS).
- Transport: REST (JSON, snake_case, JWT auth), WebSocket `/ws/agent/v1` for audio/action loop.
- Containerization: Docker multi-stage; orchestration via docker-compose (dev/prod) with nginx/postgres/redis.

## Non-Goals (now)
- Native mobile builds (later PWA wrapper).
- Multi-tenant bank brands.
- On-device/offline mode.
