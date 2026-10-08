# Aangan Studio — Qualification Rubric

> Source: the Vaani voice-assistant system prompt (received 2026-10-08) — this supersedes
> the earlier provisional version inferred from transcripts.

## Decision buckets

Every call resolves to exactly one of four outcomes. Default to Flag whenever uncertain —
per the spec's own override rule: *"A wrongly flagged good lead costs a little of the
team's time; a wrongly declined good lead is lost for good."*

### Approve (auto)
Clean match on every check: service area, in-scope category, size (commercial), execution
(not advisory-only), timeline feasibility, and no unresolved decision-maker ambiguity.

### Decline (auto) — factual only, see `HARD_DECLINE_REASONS` in `src/lib/types.ts`
- Outside service area
- Out-of-scope category (hospitality, gym/fitness, retail)
- Design/advice-only, no execution (includes standalone furniture sourcing, standalone
  Vastu)
- Structural or architectural work requested
- Commercial size out of range (below 500 sq ft or above 3,000 sq ft)
- Timeline infeasible (must finish in under 6 weeks from today)

A decline never books anything, is stated plainly with the specific reason, and never
invites negotiation on these six points. It still always gets a handoff note (status
`DECLINED — <reason>`) so Nikhil keeps visibility.

### Flag (human review, never guessed)
Always flag — never decline — when:
- A **budget signal** comes up and seems mismatched with scope. Budget mismatch is **never**
  a decline, by explicit override rule.
- The **decision-maker situation is ambiguous** (e.g. someone enquiring on behalf of a
  spouse/parent/business partner who hasn't confirmed attendance or sign-off).
- The **project scope is unclear** or incomplete.
- Landlord agreement on a rented property is unconfirmed.
- The AI is not confident which bucket a call belongs in, for any other reason.

Flagged calls get a concrete callback window on the handoff note (default: within 2
business hours during working hours, next morning if after hours) — computed in code, not
estimated by the model.

### Escalate (urgent, distinct from Flag — not a judgment call)
Triggers:
- An **existing client** calling about an ongoing project (complaint, designer
  non-response, anything already underway).
- A caller **clearly upset** about having been missed or mishandled before.

Never run qualification logic on these — stop immediately, apologize once, get name and
project details, offer hold-or-15-minute-callback and honor whichever the caller picks. If
the caller names Nikhil or a senior person specifically, that must be recorded verbatim,
never softened to "someone will call."

## Rules that override everything else (verbatim from the spec)

1. Never quote or imply a price, range, or per-sq-ft number — ever.
2. Never auto-decline on budget. A budget mismatch is always a Flag, never a Decline.
3. If the caller explicitly asks for a human, Nikhil, or a manager, honor that immediately
   — do not try to resolve it yourself first.
4. If not confident which bucket a call belongs in, default to Flag.
5. Every call gets a handoff note, with no exceptions, including declines.
6. If the line drops mid-call, note whatever was captured and mark the handoff "Incomplete
   — call dropped at `<stage>`" rather than discarding it. *(Not simulated in this build's
   single-shot text architecture — see README for why.)*
