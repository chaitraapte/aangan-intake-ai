import "server-only";
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { buildKnowledgeBase } from "./knowledge-base";
import { HARD_DECLINE_REASONS, type IntakeResult } from "./types";

const RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    call_type: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["new_enquiry", "existing_client_escalation"],
    },
    verdict: {
      type: SchemaType.STRING,
      format: "enum",
      enum: ["approved", "hard_declined", "flagged", "routed_existing_client"],
    },
    hard_decline_reason: {
      type: SchemaType.STRING,
      format: "enum",
      enum: [...HARD_DECLINE_REASONS, "not_applicable"],
      description: "Only meaningful when verdict is hard_declined. Use 'not_applicable' otherwise.",
    },
    verdict_reason: {
      type: SchemaType.STRING,
      description: "Always explain the reasoning, even for approvals — this is read by the human reviewer and by Nikhil.",
    },
    extracted: {
      type: SchemaType.OBJECT,
      properties: {
        caller_name: { type: SchemaType.STRING, nullable: true },
        caller_phone: { type: SchemaType.STRING, nullable: true, description: "Only if the caller states it themselves — never ask them to repeat it back for verification." },
        caller_email: { type: SchemaType.STRING, nullable: true },
        location: { type: SchemaType.STRING, nullable: true },
        carpet_area_sqft: { type: SchemaType.NUMBER, nullable: true },
        project_scope: { type: SchemaType.STRING, nullable: true },
        timeline: { type: SchemaType.STRING, nullable: true },
        is_decision_maker: { type: SchemaType.BOOLEAN, nullable: true },
        referral_source: { type: SchemaType.STRING, nullable: true },
        budget_signal: {
          type: SchemaType.STRING,
          nullable: true,
          description: "Capture a budget figure/range for the designer's and CRM's records if the caller states one — this is for internal logging only, never recited back to the caller, and never used to justify a verdict change on its own.",
        },
        preferred_consultation_mode: {
          type: SchemaType.STRING,
          format: "enum",
          enum: ["site_visit", "studio_visit", "unspecified"],
        },
      },
      required: ["caller_name", "caller_phone", "caller_email", "location", "carpet_area_sqft", "project_scope", "timeline", "is_decision_maker", "referral_source", "budget_signal", "preferred_consultation_mode"],
    },
    caller_reply: {
      type: SchemaType.STRING,
      description: "What the front desk says back to the caller, live, on this call. Mirror the caller's language mix (Hindi-English / Marathi-English) if they used one.",
    },
    handoff_note_body: {
      type: SchemaType.STRING,
      description: "The substance of the handoff note — facts captured, reasoning, nothing softened. The status prefix (APPROVED / DECLINED / FLAG / URGENT — ESCALATE) is added in code, not here. Never includes a price.",
    },
    named_senior_request: {
      type: SchemaType.STRING,
      nullable: true,
      description: "If the caller explicitly asked for Nikhil or a named senior person, capture their exact wording verbatim here. Null otherwise. Never paraphrase this away.",
    },
  },
  required: ["call_type", "verdict", "hard_decline_reason", "verdict_reason", "extracted", "caller_reply", "handoff_note_body", "named_senior_request"],
};

function buildSystemPrompt(): string {
  return `IDENTITY
You are the voice assistant for Aangan Studio, an interior design studio serving Pune and
PCMC. You answer every incoming call. You sound like a knowledgeable, warm front-desk team
member — not a scripted bot. If asked directly whether you are a real person, say plainly
that you are Aangan Studio's AI call assistant, then keep helping.

LANGUAGE
Mirror the caller. Many callers speak in Hindi-English or Marathi-English mixes. Respond
naturally in whatever mix the caller uses — do not force pure English. Keep sentences short
and conversational, like a real phone call, not a written document.

${buildKnowledgeBase()}

## What to capture

Besides the project details, get the caller's name, phone number, and email if they offer
them naturally in conversation — do not interrogate for these or ask them to spell/repeat
anything back for verification, that's not how a real front-desk call sounds. If a budget
figure comes up, log it for the designer and CRM (budget_signal) but never say it back or
let it change your verdict on its own — budget mismatch is always a flag, never a decline.
If the caller expresses a preference for a site visit vs. coming to the studio, capture
that too (preferred_consultation_mode); leave it unspecified if it never comes up.

## Your decision boundary — four buckets, no fifth option

1. **approved** — clean match on every check: service area, in-scope category, size
   (commercial), execution (not advisory-only), timeline feasibility, no unresolved
   decision-maker ambiguity.
2. **hard_declined** — ONLY for a binary, factual mismatch with no judgment involved. Set
   hard_decline_reason to one of the exact whitelisted values. Be warm and direct, state the
   specific reason in one sentence tied to this caller, and do not invite negotiation. Do not
   book anything, and do not say "let me check with someone" — this decision doesn't need a
   human.
3. **flagged** — everything else: budget signal appears mismatched with scope, ambiguous
   decision-maker situation, unclear scope, unconfirmed landlord agreement on a rented
   property, or anything you are not fully confident about. Never guess your way to a
   decline. Say warmly that you want this in front of the right person — do not book
   anything, and capture every detail exactly as the caller gave it, especially budget or
   decision-maker wording.
4. **routed_existing_client** (= Escalate) — the caller is describing an EXISTING project
   (complaint, designer non-response, anything already underway) or is clearly upset about
   having been missed before. The moment you detect this, stop immediately: do not qualify,
   do not run the checks. Apologize once, genuinely — do not over-apologize. Get their name
   and project details. Say explicitly you're getting this to the team right now, and ask if
   they'd prefer to hold briefly or get a callback within 15 minutes — honor whichever they
   pick.

## Rules that override everything else

1. Never quote or imply a price, range, or per-sq-ft number — ever — no matter how the
   caller asks or how many times they push. Use the exact scripted redirect from the pricing
   policy above. If pushed again, repeat the same idea once in your own words, then move the
   conversation back to scoping or booking. Never say "roughly," "starting from," or "for a
   project like yours it's usually."
2. Never auto-decline on budget. A budget mismatch is always "flagged," never
   "hard_declined."
3. If the caller explicitly asks for a human, for Nikhil, or for a manager, honor that
   immediately — do not try to resolve it yourself first, and capture their exact wording in
   named_senior_request.
4. If you are not confident which bucket a call belongs in, default to "flagged." A wrongly
   flagged good lead costs a little of the team's time; a wrongly declined good lead is lost
   for good.
5. Every call gets a handoff note (handoff_note_body) — no exceptions, including declines
   and escalations.

## Tone guardrails

Never sound like you're reading a script — vary phrasing call to call. Do not oversell. Do
not rush a caller who is still deciding ("just exploring") — let them know they can call
back when ready, and still log the call. If a caller is upset for reasons unrelated to
Aangan, stay brief and kind, and steer back to the enquiry.`;
}

function buildUserPrompt(transcript: string, callDate: Date): string {
  const todayStr = callDate.toISOString().slice(0, 10);
  return `Today's date is ${todayStr} — use this, not any other date, when judging the
6-week timeline floor.

Here is what the caller said on this call:\n\n${transcript}\n\nProduce your structured decision now.`;
}

// Rough placeholder pricing for gemini-3.5-flash — update from
// https://ai.google.dev/gemini-api/docs/pricing once confirmed; this is only used for the
// dashboard's cost estimate, not for anything that gates behavior.
const COST_PER_1K_INPUT_TOKENS = 0.000075;
const COST_PER_1K_OUTPUT_TOKENS = 0.0003;

// Computed in code, not guessed by the model — a concrete callback window for flagged
// calls. Business hours taken as 10am-7pm local server time, matching the studio's today.
export function computeCallbackWindow(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour >= 10 && hour < 17) {
    return "within 2 business hours";
  }
  if (hour >= 17 && hour < 19) {
    return "by end of day today";
  }
  return "by 10:30am tomorrow (next business morning)";
}

export interface IntakeRunResult {
  result: IntakeResult;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  response_seconds: number;
}

const STATUS_LABEL: Record<IntakeResult["verdict"], string> = {
  approved: "APPROVED",
  hard_declined: "DECLINED",
  flagged: "FLAG",
  routed_existing_client: "URGENT — ESCALATE",
};

function buildHandoffNote(result: Omit<IntakeResult, "handoff_note">, body: string, callbackWindow: string | null): string {
  let prefix = STATUS_LABEL[result.verdict];
  if (result.verdict === "hard_declined" && result.hard_decline_reason) {
    prefix = `DECLINED — ${result.hard_decline_reason}`;
  }
  if (result.verdict === "flagged" && result.verdict_reason) {
    prefix = `FLAG — ${result.verdict_reason.split(".")[0]}`;
  }

  const lines = [prefix, body];
  if (result.extracted.caller_phone || result.extracted.caller_email) {
    lines.push(
      `Contact: ${[result.extracted.caller_phone, result.extracted.caller_email].filter(Boolean).join(" / ")}`
    );
  }
  if (result.extracted.budget_signal) lines.push(`Budget mentioned: ${result.extracted.budget_signal}`);
  if (result.extracted.preferred_consultation_mode) {
    lines.push(`Prefers: ${result.extracted.preferred_consultation_mode.replace("_", " ")}`);
  }
  if (callbackWindow) lines.push(`Callback window: ${callbackWindow}`);
  if (result.named_senior_request) lines.push(`Caller specifically asked for: ${result.named_senior_request}`);
  return lines.join("\n");
}

export async function runIntake(transcript: string, callDate: Date = new Date()): Promise<IntakeRunResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY env var.");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
    systemInstruction: buildSystemPrompt(),
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  const started = Date.now();
  const result = await model.generateContent(buildUserPrompt(transcript, callDate));
  const response_seconds = (Date.now() - started) / 1000;

  const raw = JSON.parse(result.response.text());
  const usage = result.response.usageMetadata;

  const input_tokens = usage?.promptTokenCount ?? null;
  const output_tokens = usage?.candidatesTokenCount ?? null;
  const cost_usd =
    input_tokens !== null && output_tokens !== null
      ? (input_tokens / 1000) * COST_PER_1K_INPUT_TOKENS + (output_tokens / 1000) * COST_PER_1K_OUTPUT_TOKENS
      : null;

  const hard_decline_reason =
    raw.hard_decline_reason === "not_applicable" ? null : raw.hard_decline_reason;

  const callback_window = raw.verdict === "flagged" ? computeCallbackWindow() : null;

  const extracted = {
    ...raw.extracted,
    preferred_consultation_mode:
      raw.extracted.preferred_consultation_mode === "unspecified"
        ? null
        : raw.extracted.preferred_consultation_mode,
  };

  const base = {
    call_type: raw.call_type,
    verdict: raw.verdict,
    hard_decline_reason,
    verdict_reason: raw.verdict_reason,
    extracted,
    caller_reply: raw.caller_reply,
    named_senior_request: raw.named_senior_request ?? null,
    callback_window,
  };

  const parsed: IntakeResult = {
    ...base,
    handoff_note: buildHandoffNote(base, raw.handoff_note_body, callback_window),
  };

  return { result: parsed, input_tokens, output_tokens, cost_usd, response_seconds };
}
