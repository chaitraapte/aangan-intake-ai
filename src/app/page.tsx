import Link from "next/link";
import { query } from "@/lib/db";
import type { CallRecord, Verdict } from "@/lib/types";

export const dynamic = "force-dynamic";

const VERDICT_LABEL: Record<string, string> = {
  approved: "Approved",
  hard_declined: "Declined",
  flagged: "Flagged",
  routed_existing_client: "Escalated",
};

const VERDICT_BADGE: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800",
  hard_declined: "bg-gray-100 text-gray-600",
  flagged: "bg-amber-100 text-amber-800",
  routed_existing_client: "bg-red-100 text-red-700",
};

const VERDICT_BORDER: Record<string, string> = {
  approved: "border-l-emerald-400",
  hard_declined: "border-l-gray-300",
  flagged: "border-l-amber-400",
  routed_existing_client: "border-l-red-400",
};

const VERDICT_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All verdicts" },
  { value: "approved", label: "Approved" },
  { value: "flagged", label: "Flagged" },
  { value: "hard_declined", label: "Declined" },
  { value: "routed_existing_client", label: "Escalated" },
];

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

function formatCreated(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>
      <span className={`text-xl font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

interface LeadsPageProps {
  searchParams: Promise<{ q?: string; verdict?: string; sort?: string }>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const verdictFilter = params.verdict ?? "all";
  const sort = params.sort === "old" ? "old" : "new";

  let allCalls: CallRecord[] = [];
  let error: string | null = null;
  try {
    allCalls = await query<CallRecord>("select * from calls order by created_at desc limit 500");
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const counts = allCalls.reduce(
    (acc, c) => {
      acc.total += 1;
      acc[c.verdict] = (acc[c.verdict] ?? 0) + 1;
      return acc;
    },
    { total: 0 } as Record<string, number>
  );

  let calls = allCalls;
  if (verdictFilter !== "all") {
    calls = calls.filter((c) => c.verdict === (verdictFilter as Verdict));
  }
  if (q) {
    const needle = q.toLowerCase();
    calls = calls.filter((c) =>
      [c.caller_name, c.location, c.caller_email, c.caller_phone]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(needle))
    );
  }
  if (sort === "old") {
    calls = [...calls].reverse();
  }

  return (
    <main className="mx-auto max-w-4xl flex-1 p-6 flex flex-col gap-6 w-full">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Leads</h1>
          <p className="mt-1 text-sm text-gray-500">
            The designer&apos;s working view — every call, full detail. HubSpot stays the
            funnel-only summary for the founder.
          </p>
        </div>
        <nav className="flex gap-4 text-sm font-medium text-gray-600 pt-1">
          <Link href="/review" className="hover:text-gray-900 hover:underline">Review queue</Link>
          <Link href="/dashboard" className="hover:text-gray-900 hover:underline">Dashboard</Link>
        </nav>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Total" value={counts.total ?? 0} tone="text-gray-900" />
        <Stat label="Approved" value={counts.approved ?? 0} tone="text-emerald-700" />
        <Stat label="Flagged" value={counts.flagged ?? 0} tone="text-amber-700" />
        <Stat label="Declined" value={counts.hard_declined ?? 0} tone="text-gray-600" />
        <Stat label="Escalated" value={counts.routed_existing_client ?? 0} tone="text-red-700" />
      </div>

      <form className="flex flex-wrap items-center gap-2" method="GET">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search name, location, phone, email…"
          className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none"
        />
        <select
          name="verdict"
          defaultValue={verdictFilter}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        >
          {VERDICT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={sort}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:outline-none"
        >
          <option value="new">Newest first</option>
          <option value="old">Oldest first</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          Apply
        </button>
        {(q || verdictFilter !== "all" || sort !== "new") && (
          <Link href="/" className="text-sm text-gray-500 underline hover:text-gray-700">
            Clear
          </Link>
        )}
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!error && calls.length === 0 && (
        <p className="text-sm text-gray-500">No calls match these filters.</p>
      )}
      {!error && calls.length > 0 && (
        <p className="text-xs text-gray-400">
          Showing {calls.length} of {allCalls.length} calls
        </p>
      )}

      <div className="flex flex-col gap-3">
        {calls.map((call) => (
          <details
            key={call.id}
            className={`group rounded-xl border border-gray-200 border-l-4 ${VERDICT_BORDER[call.verdict] ?? "border-l-gray-300"} bg-white p-4 text-sm shadow-sm transition hover:shadow-md`}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="truncate font-semibold text-gray-900">
                  {call.caller_name ?? "Unknown caller"}
                </span>
                <span className="truncate text-gray-400">{call.location ?? "location TBD"}</span>
              </div>
              <span className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${VERDICT_BADGE[call.verdict] ?? ""}`}>
                  {VERDICT_LABEL[call.verdict] ?? call.verdict}
                </span>
                <span className="text-xs text-gray-400">{formatCreated(call.created_at)}</span>
                <span className="text-gray-300 transition group-open:rotate-180">⌄</span>
              </span>
            </summary>

            <div className="mt-4 flex flex-col gap-4 border-t border-gray-100 pt-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                {[
                  ["Phone", call.caller_phone ? <a href={`tel:${call.caller_phone}`} className="hover:underline">{call.caller_phone}</a> : "—"],
                  ["Email", call.caller_email ? <a href={`mailto:${call.caller_email}`} className="hover:underline">{call.caller_email}</a> : "—"],
                  ["Carpet area", call.carpet_area_sqft ? `${call.carpet_area_sqft} sq ft` : "—"],
                  ["Decision-maker", call.is_decision_maker === null ? "—" : call.is_decision_maker ? "Yes" : "Unconfirmed"],
                  ["Scope", call.project_scope ?? "—"],
                  ["Timeline", call.timeline ?? "—"],
                  ["Budget mentioned", call.budget_signal ?? "—"],
                  ["Prefers", call.preferred_consultation_mode?.replace("_", " ") ?? "—"],
                  ["Referral", call.referral_source ?? "—"],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</span>
                    <span className="text-gray-800">{value}</span>
                  </div>
                ))}
              </div>

              {call.consultation_slot && (
                <div className="w-fit rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
                  <span className="font-medium">Consultation booked:</span> {formatSlot(call.consultation_slot)}
                </div>
              )}

              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">AI&apos;s reasoning</span>
                <p className="mt-1 text-gray-700">{call.verdict_reason}</p>
              </div>

              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Transcript</span>
                <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                  {call.transcript}
                </pre>
              </div>

              {(call.hubspot_contact_id || call.hubspot_deal_id || call.calendar_event_id) && (
                <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                  {call.hubspot_contact_id && <span>HubSpot contact: {call.hubspot_contact_id}</span>}
                  {call.hubspot_deal_id && <span>HubSpot deal: {call.hubspot_deal_id}</span>}
                  {call.calendar_event_id && <span>Calendar event: {call.calendar_event_id}</span>}
                </div>
              )}
            </div>
          </details>
        ))}
      </div>
    </main>
  );
}
