import type { CallRecord } from "./types";

export type Urgency = "urgent" | "soon" | "flexible" | "none";

// Mirrors computeCallbackWindow()'s business-hour buckets in gemini.ts, but anchored to
// when a specific call came in (not "now") so we can tell whether its SLA has since passed.
function callbackDeadline(createdAt: Date): Date {
  const hour = createdAt.getHours();
  const deadline = new Date(createdAt);
  if (hour >= 10 && hour < 17) {
    deadline.setHours(deadline.getHours() + 2);
  } else if (hour >= 17 && hour < 19) {
    deadline.setHours(23, 59, 0, 0);
  } else {
    if (hour >= 19) deadline.setDate(deadline.getDate() + 1);
    deadline.setHours(10, 30, 0, 0);
  }
  return deadline;
}

// Urgency is "how soon does a human need to act on this," not the call's verdict —
// an approved call with a consultation tomorrow is more urgent than one booked next month,
// even though both are "approved."
export function getUrgency(call: CallRecord, now: Date = new Date()): Urgency {
  if (call.verdict === "routed_existing_client") return "urgent";
  if (call.verdict === "hard_declined") return "none";

  if (call.verdict === "flagged") {
    const deadline = callbackDeadline(new Date(call.created_at));
    return now >= deadline ? "urgent" : "soon";
  }

  if (call.verdict === "approved") {
    if (!call.consultation_slot) return "flexible";
    const hoursUntil = (new Date(call.consultation_slot).getTime() - now.getTime()) / 3_600_000;
    if (hoursUntil <= 48) return "urgent";
    if (hoursUntil <= 24 * 7) return "soon";
    return "flexible";
  }

  return "flexible";
}

export const URGENCY_LABEL: Record<Urgency, string> = {
  urgent: "Act now",
  soon: "This week",
  flexible: "Flexible",
  none: "No action needed",
};

export const URGENCY_BADGE: Record<Urgency, string> = {
  urgent: "bg-red-100 text-red-700",
  soon: "bg-amber-100 text-amber-800",
  flexible: "bg-emerald-100 text-emerald-800",
  none: "bg-gray-100 text-gray-500",
};

export const URGENCY_BORDER: Record<Urgency, string> = {
  urgent: "border-l-red-500",
  soon: "border-l-amber-400",
  flexible: "border-l-emerald-400",
  none: "border-l-gray-300",
};

export const URGENCY_DOT: Record<Urgency, string> = {
  urgent: "bg-red-500",
  soon: "bg-amber-400",
  flexible: "bg-emerald-400",
  none: "bg-gray-300",
};
