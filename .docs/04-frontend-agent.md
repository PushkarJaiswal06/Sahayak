# Frontend & Agent (Vite + React + JS)

## App Structure
- Feature folders under `src/features`: auth, dashboard, transfers, bills, profile.
- Shared: `src/api/` (axios + WS client), `src/components/`, `src/hooks/`, `src/stores/`, `src/utils/`.
- Routing: React Router; AgentContext wraps router to stay active across pages.

## Agent Overlay
- `AgentContext`: global state (mode: idle/listening/thinking/speaking), WS connection, current plan, last error.
- `VoiceOrb`: states: idle (small orb), listening (pulsing), thinking (spinner), speaking (waveform). Barge-in collapses speaking -> listening and emits STOP_AUDIO.
- `useAgentExecution`: matches action plan targets by ARIA labels/ids, dispatches synthetic events (input/change/click), returns success/failure back over WS.
- Wake: tap-to-speak now; wake-word later.

## Accessibility & Anchors
- Every interactive element gets `aria-label` and deterministic ids to serve as AI anchors.
- High contrast palette (deep blue, emerald, coral for error), large type, focus outlines on.

## Network
- REST base URL from env: `VITE_API_URL`; WS URL `VITE_WS_URL`.
- JWT stored in httpOnly cookie or memory; attach via axios interceptor; refresh flow optional.

## Error & Guardrails
- Client confirms high-value actions; shows receipts and failures.
- Sanitizes any LLM-provided strings before applying to DOM.

## Build/Deploy
- Vite build to `dist/`; served by nginx with SPA fallback, gzip, cache headers.
