export type Verdict = "approved" | "hard_declined" | "flagged" | "routed_existing_client";

export type CallType = "new_enquiry" | "existing_client_escalation";

// Whitelist of factual, binary reasons the AI may use for an autonomous decline.
// Anything outside this list must downgrade to "flagged" in code — see guardrails.ts.
// Matches the "Not offered" / "Checks to run" lists in the Vaani voice-assistant spec.
export const HARD_DECLINE_REASONS = [
  "outside_service_area",
  "out_of_scope_category", // hospitality, gym/fitness, retail
  "design_or_advice_only_no_execution", // includes standalone decor advice, furniture sourcing, Vastu-only
  "structural_or_architectural_work_requested", // wall moves, permits — never offered
  "commercial_size_out_of_range", // below 500 sq ft or above 3,000 sq ft
  "timeline_infeasible", // required completion in under 6 weeks from today
] as const;

export type HardDeclineReason = (typeof HARD_DECLINE_REASONS)[number];

export interface ExtractedFields {
  caller_name: string | null;
  caller_phone: string | null;
  caller_email: string | null;
  location: string | null;
  carpet_area_sqft: number | null;
  project_scope: string | null;
  timeline: string | null;
  is_decision_maker: boolean | null;
  referral_source: string | null;
  // Captured when mentioned, never recited back to the caller (the no-pricing rule still
  // applies to what the AI SAYS, not to what it's allowed to log for the designer/CRM).
  budget_signal: string | null;
  // "site_visit" | "studio_visit" | null — several real transcripts asked this directly.
  preferred_consultation_mode: string | null;
}

export interface IntakeResult {
  call_type: CallType;
  verdict: Verdict;
  hard_decline_reason: HardDeclineReason | null;
  verdict_reason: string;
  extracted: ExtractedFields;
  caller_reply: string;
  // Every call gets a handoff note, with no exceptions, including declines — per the
  // Vaani spec's override rule 5. The status prefix ("APPROVED" / "DECLINED — <reason>" /
  // "FLAG — <reason>" / "URGENT — ESCALATE") is composed in code, not left to the model.
  handoff_note: string;
  // Only meaningful when verdict is "flagged" — a concrete callback window (e.g. "within
  // 2 business hours", "by 10:30am tomorrow"), computed in code from the current time,
  // not guessed by the model.
  callback_window: string | null;
  // Captures caller wording verbatim when they explicitly ask for Nikhil or a named
  // senior person — must never be softened to "someone will call" (override rule 3).
  named_senior_request: string | null;
}

export interface GuardrailOutcome {
  result: IntakeResult;
  guardrail_triggered: boolean;
  guardrail_notes: string[];
}

export interface CallRecord {
  id: string;
  created_at: string;
  transcript: string;
  call_type: CallType;
  caller_name: string | null;
  caller_phone: string | null;
  caller_email: string | null;
  location: string | null;
  carpet_area_sqft: number | null;
  project_scope: string | null;
  timeline: string | null;
  is_decision_maker: boolean | null;
  referral_source: string | null;
  budget_signal: string | null;
  preferred_consultation_mode: string | null;
  verdict: Verdict;
  verdict_reason: string;
  callback_window: string | null;
  named_senior_request: string | null;
  handoff_sent: boolean;
  guardrail_triggered: boolean;
  hubspot_contact_id: string | null;
  hubspot_deal_id: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cost_usd: number | null;
  response_seconds: number | null;
}

export interface ReviewRecord {
  id: string;
  created_at: string;
  call_id: string;
  final_decision: "approved" | "declined";
  overrode_ai: boolean;
  reviewer_note: string | null;
  resolved_at: string;
}
