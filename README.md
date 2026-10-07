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

## Build phases

0. ~~Scaffold~~ — this commit. Next.js app, Supabase project + `calls`/`reviews` schema,
   knowledge base docs, env wiring.
1. Data model refinements as needed once Phase 3 surfaces gaps.
2. Knowledge base → system prompt encoding.
3. Call simulator (turn-by-turn chat standing in for the phone call).
4. Hard guardrails in code: pricing-number regex check, hard-decline whitelist enforcement.
5. Front desk review queue UI.
6. Telegram handoff.
7. Dashboard.
8. Replay all 20 phone transcripts (`docs/fixtures/phone-transcripts.md`) and confirm verdicts
   match the real front desk's historical decisions.
