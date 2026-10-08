import "server-only";
import { HARD_DECLINE_REASONS, type GuardrailOutcome, type IntakeResult } from "./types";
import { computeCallbackWindow } from "./gemini";

// The code-level backstop for the two rules a prompt alone can't be trusted to hold under
// pressure (see T02/T13 in the transcripts, where callers pushed for a price twice in the
// same call). This runs on every model response before it's ever shown to the "caller".

const PRICING_REDIRECT =
  "Pricing depends on the site, the materials you choose, and the scope — your designer will walk you through it in detail at the consultation. I can book that for you right now if you'd like.";

// Matches currency figures, lakh/crore amounts, and per-sq-ft rates — the shapes a model
// might produce even when told not to.
const PRICE_PATTERNS = [
  /₹\s?[\d,]+/i,
  /\brs\.?\s?[\d,]+/i,
  /\b[\d,]+\s?(lakh|lakhs|crore|crores)\b/i,
  /\b(per\s?sq\.?\s?ft|per\s?square\s?foot)\b.*\d/i,
  /\d+\s?(per\s?sq\.?\s?ft|per\s?square\s?foot)/i,
  /\bstarts?\s+at\b.*\d/i,
  /\baround\s+₹?\s?[\d,]+/i,
];

function containsPrice(text: string): boolean {
  return PRICE_PATTERNS.some((pattern) => pattern.test(text));
}

export function applyGuardrails(result: IntakeResult): GuardrailOutcome {
  const notes: string[] = [];
  let triggered = false;
  const next: IntakeResult = { ...result };

  // Guardrail 1: no price, ever — in the live reply or the handoff note.
  if (containsPrice(next.caller_reply)) {
    notes.push("caller_reply contained a price figure — replaced with the scripted redirect");
    next.caller_reply = PRICING_REDIRECT;
    triggered = true;
  }
  if (next.handoff_note && containsPrice(next.handoff_note)) {
    notes.push("handoff_note contained a price figure — stripped");
    next.handoff_note = next.handoff_note.replace(
      /.*(₹|\brs\.?\s?\d|lakh|crore|per\s?sq).*$/gim,
      "[price figure removed by guardrail]"
    );
    triggered = true;
  }

  // Guardrail 2: auto-decline is only legitimate on the whitelisted factual reasons.
  // Anything else — the model inventing a decline on a soft/judgment basis — gets
  // downgraded to "flagged" so a human decides instead.
  if (next.verdict === "hard_declined") {
    const reasonIsWhitelisted =
      next.hard_decline_reason !== null &&
      (HARD_DECLINE_REASONS as readonly string[]).includes(next.hard_decline_reason);

    if (!reasonIsWhitelisted) {
      notes.push(
        `hard_declined with reason "${next.hard_decline_reason}" is not on the factual whitelist — downgraded to flagged`
      );
      next.verdict = "flagged";
      next.hard_decline_reason = null;
      next.callback_window = computeCallbackWindow();

      // The handoff note's prefix and body were composed before this downgrade — rewrite
      // the status line so the note doesn't still say DECLINED for a call that's now
      // sitting in the flagged queue.
      const [, ...rest] = next.handoff_note.split("\n");
      next.handoff_note = [
        "FLAG — guardrail downgrade: AI's decline reason wasn't on the factual whitelist",
        ...rest,
        `Callback window: ${next.callback_window}`,
      ].join("\n");

      triggered = true;
    }
  }

  return { result: next, guardrail_triggered: triggered, guardrail_notes: notes };
}
