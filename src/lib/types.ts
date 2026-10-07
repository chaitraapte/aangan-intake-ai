export type Verdict = "approved" | "hard_declined" | "flagged" | "routed_existing_client";

export type CallType = "new_enquiry" | "existing_client_escalation";

// Whitelist of factual, binary reasons the AI may use for an autonomous decline.
// Anything outside this list must downgrade to "flagged" in code — see guardrails.ts.
export const HARD_DECLINE_REASONS = [
  "outside_service_area",
  "below_min_commercial_size",
  "design_only_no_execution",
  "out_of_scope_category",
  "timeline_infeasible",
] as const;

export type HardDeclineReason = (typeof HARD_DECLINE_REASONS)[number];

export interface ExtractedFields {
  location: string | null;
  carpet_area_sqft: number | null;
  project_scope: string | null;
  timeline: string | null;
  is_decision_maker: boolean | null;
  referral_source: string | null;
}

export interface IntakeResult {
  call_type: CallType;
  verdict: Verdict;
  hard_decline_reason: HardDeclineReason | null;
  verdict_reason: string;
  extracted: ExtractedFields;
  caller_reply: string;
  handoff_note: string | null;
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
  location: string | null;
  carpet_area_sqft: number | null;
  project_scope: string | null;
  timeline: string | null;
  is_decision_maker: boolean | null;
  referral_source: string | null;
  verdict: Verdict;
  verdict_reason: string;
  handoff_sent: boolean;
  guardrail_triggered: boolean;
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
