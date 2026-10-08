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

`docs/services.md` and `docs/qualified.md` are sourced from the real Vaani voice-assistant
spec (received 2026-10-08) — see the file headers for exactly what's authoritative vs. still
inferred (the spec references a fuller "Call Rubric" table that wasn't included).

## Stack

Next.js (App Router) + Neon Postgres + Gemini. (Originally scaffolded on Supabase — migrated
to Neon on 2026-10-09; the old Supabase project, `aangan-intake-ai` ref
`bimclqqnlqeqiiafvoxs`, is unused but left in place rather than deleted.)

Neon project: **Aangan AI** (`dawn-wind-66956614`, `aws-us-east-1`).

## Setup

```bash
npm install
cp .env.example .env.local
```

Still needed in `.env.local`:
- `GEMINI_API_KEY`
- `DATABASE_URL` — Neon connection string (console.neon.tech → your project → Connection
  Details; use the pooled variant)
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_DESIGNER_CHAT_ID` — optional; handoff notes log to
  the console/DB instead of sending if unset
- `HUBSPOT_ACCESS_TOKEN` — optional; HubSpot sync is skipped silently if unset

```bash
npm run dev
```

## Build phases — status

0. ✅ Scaffold — Next.js app, database schema, knowledge base docs. (Originally Supabase,
   migrated to Neon 2026-10-09 — see Stack above.)
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
   live system. **19/19 scoreable fixtures match exactly** (T08 is a missed call, not a
   qualification case). `runIntake` takes an explicit call date so the 6-week timeline floor
   is judged against when each call actually happened, not whichever day the replay is run —
   without this, results drifted daily (caught and fixed 2026-10-08). T10 and T16 diverge
   from the real front desk **on purpose** (soft budget judgment flags instead of declining;
   an upset-caller escalation routes instead of just flagging, per the spec's explicit
   trigger).

## Data captured per call

`caller_name`, `caller_phone`, `caller_email`, `location`, `carpet_area_sqft`,
`project_scope`, `timeline`, `is_decision_maker`, `referral_source`, `budget_signal`
(logged for the designer/CRM, never recited to the caller — the no-pricing rule governs
what the AI *says*, not what it's allowed to record), `preferred_consultation_mode`
(site visit vs. studio visit). None of this is interrogated for — captured only when the
caller offers it naturally, matching how a real front-desk call actually sounds.

## Integrations

- ✅ **Neon** — primary datastore (see Stack).
- ✅ **HubSpot** (`src/lib/hubspot.ts`) — every call creates/updates a contact, now including
  standard `email`/`phone` plus the custom properties (`call_verdict`, `carpet_area_sq_ft`,
  `decision_maker_confirmed`, `location`, `project_scope`, `referral_source`, `timeline` — set
  up directly in the HubSpot portal, not via API); an `approved` verdict also creates a deal
  in the default pipeline's "Inquiry" stage, associated to the contact. Dedupes by email, then
  phone, before falling back to creating a new contact. `budget_signal` and
  `preferred_consultation_mode` are captured (see Data captured below) but not yet synced to
  HubSpot as custom properties — would need `crm.schemas.contacts.write`, which this service
  key doesn't have; they still land in the Telegram handoff note.
- ✅ **Google Calendar** (`src/lib/calendar.ts`) — an `approved` verdict books the earliest
  open business-hours slot (10am–7pm IST, Mon–Sat, next 10 days) on the "aangan" calendar via
  `freebusy.query` + `events.insert`, and the booked time is appended to both `caller_reply`
  and the handoff note. Auth note: Google Cloud service-account **key creation is blocked by
  an org policy** on `pg27.mesaschool.co` (`iam.disableServiceAccountKeyCreation`) — used a
  user OAuth refresh token instead (`GOOGLE_OAUTH_CLIENT_ID/SECRET/REFRESH_TOKEN`), obtained
  via the OAuth Playground against `chaitra_apte@pg27.mesaschool.co`. Functionally equivalent
  for this build, just a different credential type. Verified live: booked two consultations
  back to back, confirmed no double-booking (second call correctly picked the next free
  hour), confirmed event details on the real calendar, then deleted both test events.
- 🟡 **Vaani** (voice/telephony) — API key obtained; real public docs found at
  `docs.vaanivoice.ai`. Architecture is different from what was originally assumed: Vaani
  runs its own model against a prompt configured in *their* dashboard (not ours), and the
  integration point for our backend is the `call_postprocessing` webhook, fired after a call
  ends with the full transcript. `src/app/api/vaani/webhook/route.ts` receives it and feeds
  the transcript straight into `processCall()` (`src/lib/process-call.ts`) — the exact same
  pipeline `/api/calls` uses. Verified locally with a simulated inbound
  `call_postprocessing` payload: correctly extracted caller/project details, approved the
  lead, created the HubSpot contact, booked the Calendar slot, and sent the Telegram
  handoff — all traced back to the (fake) Vaani call ID. Non-`call_postprocessing` events
  are acknowledged and ignored. **Still needed**: (1) port the Aangan system prompt into
  Vaani's own "Create an Agent" dashboard field — their model handles the live call, not
  ours; (2) provision a phone number and assign it to that agent; (3) a publicly reachable
  URL to register as the webhook endpoint (currently only `localhost` — needs either a
  tunnel for testing or a real deployment, not done yet pending that decision).

## Not built (by design, pending the above)

- Real telephony/voice — out of scope for the "simulated demo" fidelity decision regardless
  of Vaani's arrival; the turn-by-turn conversation state and mid-call-drop handling the spec
  describes need an actual voice platform to exercise meaningfully.
