# System Architecture

## Style
Event-driven micro-modular: SPA client + agent overlay; FastAPI gateway; self-hosted PostgreSQL; Redis for cache/session/pub-sub; AI services via HTTP/WS.

## High-Level Components
- Client: React SPA pages (dashboard, transfers, bills, profile) + global AgentContext overlay.
- Backend: FastAPI with modules for auth, banking, agent orchestrator, WebSocket handler.
- Data: PostgreSQL (users, accounts, ledger immutable, beneficiaries, audit_logs), Redis (sessions, rate-limit counters, WS broadcast, ephemeral context).
- External AI: Deepgram WS STT, Groq LLM, ElevenLabs TTS.

## Agentic Loop
1) Client captures current URL + ARIA element ids and streams audio via WS.
2) Backend: STT (Deepgram) -> text.
3) LLM (Groq) + state -> JSON Action Plan (tool calls: navigate, fill, click, speak).
4) Backend dispatches plan via WS to client.
5) Client executes synthetic events on matched ARIA elements; captures success/failure.
6) Feedback -> TTS -> play to user; audit_log persisted.

## Guardrails
- Server-side: transaction limits, role checks, hard caps regardless of LLM intent.
- Client-side: require secondary confirm for high amounts; barge-in stops TTS; sanitize all LLM form values.
- Audit: every voice command + resulting action stored.

## Data Flow (REST vs WS)
- REST: auth, balance, list transactions, create transfer, list/pay bills, manage beneficiaries, profile.
- WS: `/ws/agent/v1` with auth token; events `AUDIO_CHUNK`, `CONTEXT_UPDATE`; commands `ACTION_DISPATCH`, `AGENT_SPEAK`, `STOP_AUDIO`.

## Scaling Notes
- Redis pub/sub for WS fan-out (horizontal scaling of backend workers).
- Stateless backend; DB connections pooled; nginx terminates TLS and proxies.
