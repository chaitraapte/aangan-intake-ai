import Link from "next/link";
import { createServiceRoleClient } from "@/lib/supabase/server";

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
  const supabase = createServiceRoleClient();

  const { data: calls } = await supabase.from("calls").select("*");
  const { data: reviews } = await supabase.from("reviews").select("*");

  const total = calls?.length ?? 0;
  const approved = calls?.filter((c) => c.verdict === "approved").length ?? 0;
  const hardDeclined = calls?.filter((c) => c.verdict === "hard_declined").length ?? 0;
  const flagged = calls?.filter((c) => c.verdict === "flagged").length ?? 0;
  const routedExisting = calls?.filter((c) => c.verdict === "routed_existing_client").length ?? 0;
  const guardrailTriggers = calls?.filter((c) => c.guardrail_triggered).length ?? 0;

  const conversionRate = total > 0 ? ((approved / total) * 100).toFixed(0) : "0";

  const resolvedReviews = reviews?.length ?? 0;
  const overrides = reviews?.filter((r) => r.overrode_ai).length ?? 0;
  const overrideRate = resolvedReviews > 0 ? ((overrides / resolvedReviews) * 100).toFixed(0) : "0";

  const avgResponseSeconds =
    total > 0
      ? (
          (calls ?? []).reduce((sum, c) => sum + (c.response_seconds ?? 0), 0) / total
        ).toFixed(1)
      : "0";

  const totalCost = (calls ?? []).reduce((sum, c) => sum + (c.cost_usd ?? 0), 0);

  return (
    <main className="mx-auto max-w-3xl flex-1 p-6 flex flex-col gap-6 w-full">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <nav className="flex gap-3 text-sm">
          <Link href="/" className="underline">Call simulator</Link>
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
