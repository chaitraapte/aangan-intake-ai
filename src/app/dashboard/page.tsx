import Link from "next/link";
import { query } from "@/lib/db";
import type { CallRecord, ReviewRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-200 p-4">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const calls = await query<CallRecord>("select * from calls");
  const reviews = await query<ReviewRecord>("select * from reviews");

  const total = calls.length;
  const approved = calls.filter((c) => c.verdict === "approved").length;
  const hardDeclined = calls.filter((c) => c.verdict === "hard_declined").length;
  const flagged = calls.filter((c) => c.verdict === "flagged").length;
  const routedExisting = calls.filter((c) => c.verdict === "routed_existing_client").length;
  const guardrailTriggers = calls.filter((c) => c.guardrail_triggered).length;

  const conversionRate = total > 0 ? ((approved / total) * 100).toFixed(0) : "0";

  const resolvedReviews = reviews.length;
  const overrides = reviews.filter((r) => r.overrode_ai).length;
  const overrideRate = resolvedReviews > 0 ? ((overrides / resolvedReviews) * 100).toFixed(0) : "0";

  // node-postgres returns numeric columns as strings to avoid precision loss — coerce.
  const avgResponseSeconds =
    total > 0
      ? (calls.reduce((sum, c) => sum + Number(c.response_seconds ?? 0), 0) / total).toFixed(1)
      : "0";

  const totalCost = calls.reduce((sum, c) => sum + Number(c.cost_usd ?? 0), 0);

  return (
    <main className="mx-auto max-w-3xl flex-1 p-6 flex flex-col gap-6 w-full">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <nav className="flex gap-3 text-sm">
          <Link href="/" className="underline">Call simulator</Link>
          <Link href="/leads" className="underline">Leads</Link>
          <Link href="/review" className="underline">Review queue</Link>
        </nav>
      </header>
      <p className="text-sm text-gray-500">
        What Nikhil used to pull by hand every month — now standing.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Stat label="Total calls" value={String(total)} />
        <Stat label="Approved" value={String(approved)} />
        <Stat label="Hard declined" value={String(hardDeclined)} />
        <Stat label="Flagged for review" value={String(flagged)} />
        <Stat label="Routed (existing client)" value={String(routedExisting)} />
        <Stat label="Conversion rate" value={`${conversionRate}%`} />
        <Stat label="Avg response time" value={`${avgResponseSeconds}s`} />
        <Stat label="Override rate" value={`${overrideRate}%`} />
        <Stat label="Guardrail interventions" value={String(guardrailTriggers)} />
        <Stat label="Run cost (estimated)" value={`$${totalCost.toFixed(4)}`} />
      </div>
    </main>
  );
}
