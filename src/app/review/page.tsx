import Link from "next/link";
import { query } from "@/lib/db";
import type { CallRecord } from "@/lib/types";
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

  return (
    <main className="mx-auto max-w-3xl flex-1 p-6 flex flex-col gap-6 w-full">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Front desk review queue</h1>
        <nav className="flex gap-3 text-sm">
          <Link href="/" className="underline">Call simulator</Link>
          <Link href="/leads" className="underline">Leads</Link>
          <Link href="/dashboard" className="underline">Dashboard</Link>
        </nav>
      </header>
      <p className="text-sm text-gray-500">
        Same-business-day SLA. These are the calls the AI couldn&apos;t approve or
        factually decline on its own — every one is a soft judgment call a human owns.
      </p>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {calls.length === 0 && (
        <p className="text-sm text-gray-500">Queue is empty.</p>
      )}

      <div className="flex flex-col gap-4">
        {calls.map((call) => (
          <div key={call.id} className="rounded border border-amber-300 bg-amber-50 p-4 flex flex-col gap-2 text-sm">
            <div className="text-xs text-gray-500">{new Date(call.created_at).toLocaleString()}</div>
            <div><span className="font-semibold">Caller:</span> {call.caller_name ?? "unknown"} — {[call.caller_phone, call.caller_email].filter(Boolean).join(" / ") || "no contact info captured"}</div>
            <div><span className="font-semibold">Transcript:</span> {call.transcript}</div>
            <div><span className="font-semibold">AI&apos;s reasoning:</span> {call.verdict_reason}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
              <div><span className="font-semibold">Location:</span> {call.location ?? "—"}</div>
              <div><span className="font-semibold">Size:</span> {call.carpet_area_sqft ?? "—"} sq ft</div>
              <div><span className="font-semibold">Scope:</span> {call.project_scope ?? "—"}</div>
              <div><span className="font-semibold">Timeline:</span> {call.timeline ?? "—"}</div>
              <div><span className="font-semibold">Budget mentioned:</span> {call.budget_signal ?? "—"}</div>
              <div><span className="font-semibold">Prefers:</span> {call.preferred_consultation_mode?.replace("_", " ") ?? "—"}</div>
            </div>
            <ReviewActions callId={call.id} />
          </div>
        ))}
      </div>
    </main>
  );
}
