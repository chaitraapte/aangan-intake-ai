# Aangan intake AI

Simulated phone-intake system for Aangan Studio (MESA Case 03 — "Nikhil: Unanswered
Enquiries"). Built per the components map worked out before coding started; see `docs/` for
the knowledge base the AI reasons against.

Phone channel only. WhatsApp and the web form are explicitly out of scope for this build.

## Locked decisions (don't relitigate without reopening the case)

- **No price is ever quoted**, under any pressure — scripted redirect to booking a
  consultation, per `docs/pricing.md`. Enforced in code (pattern check on the AI's output),
  not just by prompting.
- **The AI may auto-approve or auto-decline only on binary, written-down criteria** (service
  area, minimum size, timeline floor, scope category — see `docs/services.md`). Anything
  requiring interpretation (budget fit, ambiguous decision-maker, unclear scope) is flagged
  to human review with the AI's reasoning attached — never auto-rejected.
- **Existing-client calls** (an active project, not a new enquiry) are detected as a hard
  factual signal and routed straight to a human, bypassing qualification logic entirely —
  out of scope for this build to try to triage those.
- **Designer handoff via Telegram**, not email — avoids relocating the "sits unanswered for
  48 hours" failure mode from the front desk's inbox to the designer's.
- **Flagged calls are reviewed by the front desk at the next shift start** (same-business-day
  SLA), not by Nikhil personally and not by a designer — keeps the human-in-the-loop step
  from becoming a new bottleneck.
- **Dashboard tracks**: volume, % answered within the response-time target, conversion,
  override rate (how often the front desk reverses the AI's lean — the main trust signal),
  and running cost.

## Known gap

`docs/services.md` and `docs/qualified.md` are provisional — inferred from the 20 real phone
transcripts in `docs/fixtures/phone-transcripts.md`, not from Nikhil's actual source files
(a Google Drive permission issue blocked retrieval). Verify both against the real documents
before trusting the size/timeline/budget thresholds in production logic.

## Stack

Next.js (App Router) + Supabase + Gemini — same pattern as the TripSync build this repo is
intentionally kept separate from.

Supabase project: `aangan-intake-ai` (ref `bimclqqnlqeqiiafvoxs`, `ap-southeast-1`).

## Setup

```bash
npm install
cp .env.example .env.local   # already pre-filled with the Supabase URL + anon key below
```

Still needed in `.env.local`:
- `GEMINI_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase dashboard → Project Settings → API → service_role
  secret (not exposed via MCP for security, grab it yourself)
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_DESIGNER_CHAT_ID` — optional; handoff notes log to
  the console/DB instead of sending if unset

```bash
npm run dev
```

## Build phases — status

0. ✅ Scaffold — Next.js app, Supabase project + `calls`/`reviews` schema, knowledge base docs.
1. ✅ Data model — `guardrail_triggered` column added once Phase 4 needed it.
2. ✅ Knowledge base → system prompt (`src/lib/knowledge-base.ts`, `src/lib/gemini.ts`).
3. ✅ Call simulator — single-shot per call (not full turn-by-turn state), matching the
   "simulated demo" fidelity decision: paste what the caller said, get the verdict, the live
   reply, and the handoff note. `/` in the app.
4. ✅ Hard guardrails in code (`src/lib/guardrails.ts`) — a regex backstop strips any price
   figure from the reply/handoff note regardless of what the model produced, and any
   `hard_declined` verdict not on the factual whitelist is downgraded to `flagged`.
5. ✅ Front desk review queue — `/review`, same-business-day queue, approve/decline writes
   back to `calls` and `reviews`.
6. ✅ Designer handoff — Telegram if `TELEGRAM_BOT_TOKEN`/`TELEGRAM_DESIGNER_CHAT_ID` are set,
   otherwise logs to console/DB (`src/lib/telegram.ts`) — swap-in is a one-line change once
   the token arrives.
7. ✅ Dashboard — `/dashboard`: volume, verdict breakdown, conversion, override rate,
   guardrail interventions, estimated run cost.
8. ✅ Replay — `/replay` runs all 20 phone transcripts (`src/lib/fixtures.ts`) against the
   live system. **17/19 scoreable fixtures matched exactly** (T08 is a missed call, not a
   qualification case). The two "mismatches" (T02, T07) are the AI flagging a timeline
   ambiguity that the real front desk didn't scrutinize — a defensible divergence given the
   locked "when in doubt, flag" rule, not a bug; see the notes in `fixtures.ts`. T10 and T14
   diverge from the real front desk **on purpose** (soft budget/decision-maker judgment calls
   now flag instead of auto-resolving).

## Not built (by design)

- Real telephony/voice (Vaani or otherwise) — pending the API key, and out of scope for the
  "simulated demo" fidelity decision regardless.
- Turn-by-turn conversational memory across multiple exchanges in one call — the simulator
  takes the full caller statement at once, which was sufficient to validate every locked
  decision against the real transcripts.
