import Link from "next/link";
import { query } from "@/lib/db";
import type { CallRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

const VERDICT_LABEL: Record<string, string> = {
  approved: "Approved",
  hard_declined: "Declined",
  flagged: "Flagged",
  routed_existing_client: "Escalated",
};

const VERDICT_COLOR: Record<string, string> = {
  approved: "bg-green-100 text-green-800",
  hard_declined: "bg-gray-100 text-gray-600",
  flagged: "bg-amber-100 text-amber-800",
  routed_existing_client: "bg-red-100 text-red-800",
};

function formatSlot(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export default async function LeadsPage() {
  let calls: CallRecord[] = [];
  let error: string | null = null;
  try {
    calls = await query<CallRecord>("select * from calls order by created_at desc limit 100");
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  return (
    <main className="mx-auto max-w-4xl flex-1 p-6 flex flex-col gap-6 w-full">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Leads — designer view</h1>
        <nav className="flex gap-3 text-sm">
          <Link href="/review" className="underline">Review queue</Link>
          <Link href="/dashboard" className="underline">Dashboard</Link>
        </nav>
      </header>
      <p className="text-sm text-gray-500">
        Every call, full detail — contact info, project brief, scheduled consultation time,
        and the transcript. This is the working view; HubSpot stays the funnel-only summary
        for the founder.
      </p>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      {calls.length === 0 && <p className="text-sm text-gray-500">No calls yet.</p>}

      <div className="flex flex-col gap-4">
        {calls.map((call) => (
          <details key={call.id} className="rounded border border-gray-200 p-4 text-sm">
            <summary className="cursor-pointer flex items-center justify-between gap-3">
              <span className="font-semibold">
                {call.caller_name ?? "Unknown caller"} — {call.location ?? "location TBD"}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className={`rounded px-2 py-0.5 text-xs ${VERDICT_COLOR[call.verdict] ?? ""}`}>
                  {VERDICT_LABEL[call.verdict] ?? call.verdict}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(call.created_at).toLocaleDateString("en-IN")}
                </span>
              </span>
            </summary>

            <div className="mt-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
                <div><span className="font-semibold">Phone:</span> {call.caller_phone ?? "—"}</div>
                <div><span className="font-semibold">Email:</span> {call.caller_email ?? "—"}</div>
                <div><span className="font-semibold">Carpet area:</span> {call.carpet_area_sqft ?? "—"} sq ft</div>
                <div><span className="font-semibold">Decision-maker:</span> {call.is_decision_maker === null ? "—" : call.is_decision_maker ? "Yes" : "Unconfirmed"}</div>
                <div><span className="font-semibold">Scope:</span> {call.project_scope ?? "—"}</div>
                <div><span className="font-semibold">Timeline:</span> {call.timeline ?? "—"}</div>
                <div><span className="font-semibold">Budget mentioned:</span> {call.budget_signal ?? "—"}</div>
                <div><span className="font-semibold">Prefers:</span> {call.preferred_consultation_mode?.replace("_", " ") ?? "—"}</div>
                <div><span className="font-semibold">Referral:</span> {call.referral_source ?? "—"}</div>
                <div><span className="font-semibold">Consultation:</span> {formatSlot(call.consultation_slot)}</div>
              </div>

              <div>
                <span className="font-semibold">AI&apos;s reasoning:</span>
                <p className="mt-1 text-gray-700">{call.verdict_reason}</p>
              </div>

              <div>
                <span className="font-semibold">Transcript:</span>
                <pre className="mt-1 whitespace-pre-wrap text-gray-600 bg-gray-50 rounded p-2 text-xs">
                  {call.transcript}
                </pre>
              </div>

              <div className="flex gap-4 text-xs text-gray-400">
                {call.hubspot_contact_id && <span>HubSpot contact: {call.hubspot_contact_id}</span>}
                {call.hubspot_deal_id && <span>HubSpot deal: {call.hubspot_deal_id}</span>}
                {call.calendar_event_id && <span>Calendar event: {call.calendar_event_id}</span>}
              </div>
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}
