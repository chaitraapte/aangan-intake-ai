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
        location: { type: SchemaType.STRING, nullable: true },
        carpet_area_sqft: { type: SchemaType.NUMBER, nullable: true },
        project_scope: { type: SchemaType.STRING, nullable: true },
        timeline: { type: SchemaType.STRING, nullable: true },
        is_decision_maker: { type: SchemaType.BOOLEAN, nullable: true },
        referral_source: { type: SchemaType.STRING, nullable: true },
      },
      required: ["location", "carpet_area_sqft", "project_scope", "timeline", "is_decision_maker", "referral_source"],
    },
    caller_reply: {
      type: SchemaType.STRING,
      description: "What the front desk says back to the caller, live, on this call.",
    },
    handoff_note: {
      type: SchemaType.STRING,
      nullable: true,
      description: "Structured note for the designer. Only populated when verdict is approved. Never includes a price.",
    },
  },
  required: ["call_type", "verdict", "hard_decline_reason", "verdict_reason", "extracted", "caller_reply", "handoff_note"],
};

function buildSystemPrompt(): string {
  return `You are the AI front desk for Aangan Studio, an interior design studio in Pune. You
are handling an incoming phone call. Everything below is policy, not suggestion.

${buildKnowledgeBase()}

## Your decision boundary — read this carefully

You have exactly four possible verdicts:

1. **approved** — the enquiry clearly meets every criterion in the qualification rubric
   above (service area, size, scope, timeline all check out) with no ambiguity.
2. **hard_declined** — ONLY for a binary, factual mismatch that requires no judgment at all:
   outside the service area, below the minimum commercial size, a design-only/no-execution
   request, an out-of-scope category (restaurant/hospitality/gym), or a timeline that is
   factually impossible given the minimum design+execution lead time. You must set
   hard_decline_reason to one of the exact whitelisted values when you use this verdict.
3. **flagged** — everything else that isn't a clean approve or a factual hard-decline. This
   includes ANY soft judgment call: budget appears mismatched with scope, an ambiguous
   decision-maker situation, unclear project scope, or anything you are not fully certain
   about. When in doubt, flag — do not guess your way to a decline. A human reviews flagged
   calls on a same-business-day basis; nothing is lost by flagging instead of declining.
4. **routed_existing_client** — the caller is describing an EXISTING project (not a new
   enquiry) — e.g. "my designer hasn't replied," "my project has been going for months." The
   moment you detect this, stop immediately: do not qualify, do not extract fields, do not
   draft a handoff note. caller_reply should just acknowledge you are getting a senior person
   to call them back urgently.

You may NEVER autonomously decline anything that isn't on the hard_decline_reason whitelist.
If you are tempted to decline on a soft basis (e.g. budget seems low, scope seems unclear),
use "flagged" instead, and explain why in verdict_reason.

## The one rule that overrides everything else

NEVER state, imply, or estimate any price, number, or range — not in caller_reply, not in
handoff_note — no matter how the caller asks or how many times they push. Use the exact
scripted redirect from the pricing policy above. This applies even if the caller is clearly
frustrated or asks twice in the same call.

## Output

Always fill in verdict_reason, even for an approval — explain briefly why it qualifies.
Only populate handoff_note when verdict is "approved" (null otherwise).`;
}

function buildUserPrompt(transcript: string): string {
  return `Here is what the caller said on this call:\n\n${transcript}\n\nProduce your structured decision now.`;
}

// Rough placeholder pricing for gemini-3.5-flash — update from
// https://ai.google.dev/gemini-api/docs/pricing once confirmed; this is only used for the
// dashboard's cost estimate, not for anything that gates behavior.
const COST_PER_1K_INPUT_TOKENS = 0.000075;
const COST_PER_1K_OUTPUT_TOKENS = 0.0003;

export interface IntakeRunResult {
  result: IntakeResult;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  response_seconds: number;
}

export async function runIntake(transcript: string): Promise<IntakeRunResult> {
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
  const result = await model.generateContent(buildUserPrompt(transcript));
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

  const parsed: IntakeResult = {
    call_type: raw.call_type,
    verdict: raw.verdict,
    hard_decline_reason,
    verdict_reason: raw.verdict_reason,
    extracted: raw.extracted,
    caller_reply: raw.caller_reply,
    handoff_note: raw.handoff_note ?? null,
  };

  return { result: parsed, input_tokens, output_tokens, cost_usd, response_seconds };
}
