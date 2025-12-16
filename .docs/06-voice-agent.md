# Voice Agent Deep Dive

## Purpose
Define the end-to-end behavior of the Sahayak voice agent: capture, perceive, reason, dispatch, execute, and give feedback with strong guardrails.

## Lifecycle & States
- idle: orb small; mic off.
- listening: orb pulses; streaming AUDIO_CHUNK frames.
- thinking: spinner; backend STT+LLM in flight.
- speaking: waveform; TTS playing; barge-in permitted.
- error: transient failure; show toast; revert to idle.

## Client Data Flow
1) Capture UI context: current URL, focused element, visible ARIA ids/names, locale, device info.
2) Open WS: `wss://<host>/ws/agent/v1?auth_token=...` (JWT).
3) Send events:
   - AUDIO_CHUNK (binary OpCode): raw PCM/Opus frames; include seq number.
   - CONTEXT_UPDATE (JSON): `{ url, aria_ids: string[], locale, screen: { w, h }, ts }`.
4) Receive commands:
   - ACTION_DISPATCH: JSON action plan.
   - AGENT_SPEAK: TTS URL or base64 audio; optional `text` for captions.
   - STOP_AUDIO: stop playback on barge-in.
5) Execute plan: match targets by aria-label/id; synthetic events; report result.
6) Emit telemetry: `{plan_id, step, status, error?}`.

## Action Plan Schema (example)
```json
{
  "plan_id": "uuid",
  "steps": [
    {"kind": "navigate", "url": "/transfers"},
    {"kind": "fill", "target": {"aria": "amount"}, "value": "500"},
    {"kind": "click", "target": {"aria": "submit-transfer"}},
    {"kind": "speak", "text": "Sent 500 rupees to Mom"}
  ],
  "meta": {"confidence": 0.74, "language": "hi-en"}
}
```
Targets prefer `aria` matches; fallback to deterministic ids.

## Guardrails
- Client: barge-in during speaking -> emit STOP_AUDIO; confirm high-value actions; sanitize LLM-proposed strings before DOM write.
- Server: hard transaction limits, role checks, daily caps; reject unsafe plans before dispatch; audit every command/result.
- Input hygiene: strip HTML/JS; length caps; numeric validation for amounts; locale-normalize currency.

## Backend Pipeline
1) Ingest audio + context over WS.
2) STT: Deepgram streaming; partials aggregated; final transcript.
3) Reason: Groq Llama 3 70B with tool definitions; include UI context; produce action plan; add guardrail validation.
4) Dispatch: send ACTION_DISPATCH to client; optionally pre-compute TTS prompts.
5) TTS: ElevenLabs; stream URL/base64 to client via AGENT_SPEAK.
6) Audit: store transcript, plan, results, timings, user id.

## Latency Targets
- Time-to-first-token (LLM): < 900 ms.
- End-to-action (voice command to DOM action start): < 1.5 s on 4G.
- Audio RTT (chunk to ack): < 150 ms.

## Error Handling
- STT failure: ask user to repeat; stay in listening.
- LLM failure/timeout: return safe apology + do nothing.
- Target not found: return error with missing aria id; suggest retry.
- TTS failure: fallback to text caption toast.
- WS drop: exponential backoff reconnect; surface banner.

## Security & Privacy
- JWT required on WS; short-lived tokens; server verifies per message.
- PII redaction in logs; transcripts stored encrypted at rest.
- Rate limiting: per-user and per-IP on WS connects and commands (Redis counters).
- CSRF not applicable to WS; still enforce origin checks on REST.

## Telemetry & Metrics
- Counters: ws_connections, audio_chunks, action_plans, action_failures, barge_ins.
- Latencies: stt_ms, llm_ms, tts_ms, dispatch_ms, dom_exec_ms (client-reported).
- Quality: word_error_rate estimate from user corrections; plan_success_rate.
- Alerts: high action_failures, high ws_disconnects, latency SLO breaches.

## Testing Matrix
- Voice paths: balance inquiry, transfer, bill pay, beneficiary add, cancel midway (barge-in).
- Locales: en, hi, mixed hi-en.
- Network: 3G/4G/high-latency; WS drops; reconnect.
- Accessibility: screen reader active; focus traps; aria targeting robustness.
- Limits: amounts above cap; unauthorized role tries admin endpoints.

## Client Components (bindings)
- AgentContext: owns WS, state machine, dispatches to hooks.
- VoiceOrb: UI state; handles mic toggle and barge-in.
- useAgentExecution: resolves targets, fires events, reports outcomes.
- api/websocket.js: reconnect with jitter, auth token attach, pong/ping if needed.

## Configuration (env)
- VITE_WS_URL, VITE_API_URL
- Backend: STT/LLM/TTS keys, WS max message size, rate limits, timeout budgets.
