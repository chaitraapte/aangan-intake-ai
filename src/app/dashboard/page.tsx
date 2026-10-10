import { query } from "@/lib/db";
import type { CallRecord, ReviewRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

function Tile({ label, value, colorClass }: { label: string; value: string; colorClass: string }) {
  return (
    <div className={`flex flex-col gap-2 rounded-2xl p-4 text-white shadow-sm ${colorClass}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-white/80">{label}</span>
      <span className="text-2xl font-semibold">{value}</span>
    </div>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-4 shadow-sm flex flex-col gap-3 ${className}`}>
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      {children}
    </div>
  );
}

function Donut({ segments }: { segments: { label: string; value: number; colorVar: string }[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  let acc = 0;
  const stops = segments
    .map((s) => {
      const start = (acc / total) * 360;
      acc += s.value;
      const end = (acc / total) * 360;
      return `${s.colorVar} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative h-28 w-28 shrink-0 rounded-full"
        style={{ background: total > 0 ? `conic-gradient(${stops})` : "#e5e7eb" }}
      >
        <div className="absolute inset-3 flex items-center justify-center rounded-full bg-white">
          <span className="text-lg font-semibold text-gray-800">{total}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5 text-xs text-gray-600">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.colorVar }} />
            {s.label} — {s.value}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Gauge({ percent, label, colorVar }: { percent: number; label: string; colorVar: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative h-28 w-28 rounded-full"
        style={{ background: `conic-gradient(${colorVar} ${clamped * 3.6}deg, #e5e7eb 0deg)` }}
      >
        <div className="absolute inset-3 flex items-center justify-center rounded-full bg-white">
          <span className="text-lg font-semibold text-gray-800">{clamped.toFixed(0)}%</span>
        </div>
      </div>
      <span className="text-xs text-gray-500">{label}</span>
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

  const conversionRate = total > 0 ? (approved / total) * 100 : 0;

  const resolvedReviews = reviews.length;
  const overrides = reviews.filter((r) => r.overrode_ai).length;
  const overrideRate = resolvedReviews > 0 ? (overrides / resolvedReviews) * 100 : 0;

  const avgResponseSeconds =
    total > 0
      ? (calls.reduce((sum, c) => sum + Number(c.response_seconds ?? 0), 0) / total).toFixed(1)
      : "0";

  const totalCost = calls.reduce((sum, c) => sum + Number(c.cost_usd ?? 0), 0);

  const days: { key: string; label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, label: d.toLocaleDateString("en-IN", { weekday: "short" }), count: 0 });
  }
  for (const c of calls) {
    const key = new Date(c.created_at).toISOString().slice(0, 10);
    const bucket = days.find((d) => d.key === key);
    if (bucket) bucket.count += 1;
  }
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });

  return (
    <main className="flex-1 p-6 sm:p-8 flex flex-col gap-6 w-full">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            What Nikhil used to pull by hand every month — now standing.
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 shadow-sm">
          {today}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Tile label="Total calls" value={String(total)} colorClass="bg-indigo-500" />
        <Tile label="Approved" value={String(approved)} colorClass="bg-emerald-500" />
        <Tile label="Flagged" value={String(flagged)} colorClass="bg-amber-500" />
        <Tile label="Declined" value={String(hardDeclined)} colorClass="bg-gray-400" />
        <Tile label="Escalated" value={String(routedExisting)} colorClass="bg-red-500" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Verdict breakdown">
          <Donut
            segments={[
              { label: "Approved", value: approved, colorVar: "#10b981" },
              { label: "Flagged", value: flagged, colorVar: "#f59e0b" },
              { label: "Declined", value: hardDeclined, colorVar: "#9ca3af" },
              { label: "Escalated", value: routedExisting, colorVar: "#ef4444" },
            ]}
          />
        </Card>

        <Card title="Calls, last 7 days">
          <div className="flex h-28 items-end gap-2">
            {days.map((d) => (
              <div key={d.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <div
                  className="w-full rounded-t-md bg-indigo-400"
                  style={{ height: `${Math.max(6, (d.count / maxDay) * 100)}%` }}
                  title={`${d.count} calls`}
                />
                <span className="text-[10px] text-gray-400">{d.label}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Guardrail interventions">
          <div className="flex flex-1 flex-col items-center justify-center gap-1">
            <span className="text-3xl font-semibold text-gray-800">{guardrailTriggers}</span>
            <span className="text-xs text-gray-500 text-center">
              calls where code-level guardrails overrode the model&apos;s raw output
            </span>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card title="Conversion rate" className="items-center">
          <Gauge percent={conversionRate} label="of calls approved" colorVar="#10b981" />
        </Card>
        <Card title="Override rate" className="items-center">
          <Gauge percent={overrideRate} label="of reviews reversed the AI" colorVar="#6366f1" />
        </Card>
        <Card title="Run cost & latency">
          <div className="flex flex-1 flex-col justify-center gap-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-gray-500">Avg response time</span>
              <span className="text-lg font-semibold text-gray-800">{avgResponseSeconds}s</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-gray-500">Estimated run cost</span>
              <span className="text-lg font-semibold text-gray-800">${totalCost.toFixed(4)}</span>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}
