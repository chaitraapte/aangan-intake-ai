import { query } from "@/lib/db";
import type { CallRecord } from "@/lib/types";
import { getUrgency, URGENCY_LABEL, URGENCY_BADGE, URGENCY_BORDER } from "@/lib/urgency";
import ReviewActions from "./ReviewActions";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  let calls: CallRecord[] = [];
  let error: string | null = null;
  try {
    calls = await query<CallRecord>(
      "select * from calls where verdict = 'flagged' order by created_at asc"
    );
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  // Overdue (past SLA) first, same as the Leads page's urgency ordering.
  const sorted = [...calls].sort((a, b) => {
    const ua = getUrgency(a) === "urgent" ? 0 : 1;
    const ub = getUrgency(b) === "urgent" ? 0 : 1;
    return ua - ub;
  });

  return (
    <main className="flex-1 p-6 sm:p-8 flex flex-col gap-6 w-full">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Review queue</h1>
        <p className="mt-1 text-sm text-gray-500">
          Same-business-day SLA. These are the calls the AI couldn&apos;t approve or
          factually decline on its own — every one is a soft judgment call a human owns.
        </p>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && calls.length === 0 && (
        <p className="text-sm text-gray-500">Queue is empty — nothing waiting on a human.</p>
      )}

      <div className="flex flex-col gap-4">
        {sorted.map((call) => {
          const urgency = getUrgency(call);
          return (
            <div
              key={call.id}
              className={`rounded-2xl border border-gray-200 border-l-4 ${URGENCY_BORDER[urgency]} bg-white p-4 shadow-sm flex flex-col gap-3 text-sm`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${URGENCY_BADGE[urgency]}`}>
                    {URGENCY_LABEL[urgency]}
                  </span>
                  <span className="font-semibold text-gray-900">{call.caller_name ?? "Unknown caller"}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(call.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                </span>
              </div>

              <div className="text-gray-600">
                {[call.caller_phone, call.caller_email].filter(Boolean).join(" / ") || "no contact info captured"}
              </div>

              <div className="rounded-lg bg-gray-50 p-3 text-gray-600 text-xs">{call.transcript}</div>

              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">AI&apos;s reasoning</span>
                <p className="mt-1 text-gray-700">{call.verdict_reason}</p>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                {[
                  ["Location", call.location ?? "—"],
                  ["Size", call.carpet_area_sqft ? `${call.carpet_area_sqft} sq ft` : "—"],
                  ["Scope", call.project_scope ?? "—"],
                  ["Timeline", call.timeline ?? "—"],
                  ["Budget mentioned", call.budget_signal ?? "—"],
                  ["Prefers", call.preferred_consultation_mode?.replace("_", " ") ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>
                    <span className="text-gray-800">{value}</span>
                  </div>
                ))}
              </div>

              <ReviewActions callId={call.id} />
            </div>
          );
        })}
      </div>
    </main>
  );
}
