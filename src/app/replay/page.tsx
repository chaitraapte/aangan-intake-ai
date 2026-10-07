import Link from "next/link";
import { runIntake } from "@/lib/gemini";
import { applyGuardrails } from "@/lib/guardrails";
import { FIXTURES } from "@/lib/fixtures";

export const dynamic = "force-dynamic";

interface RowResult {
  id: string;
  expected: string | null;
  actual: string | null;
  pass: boolean | null;
  reason: string;
  note?: string;
  error?: string;
}

async function runReplay(): Promise<RowResult[]> {
  const rows: RowResult[] = [];

  for (const fixture of FIXTURES) {
    if (fixture.expectedVerdict === null) {
      rows.push({
        id: fixture.id,
        expected: null,
        actual: null,
        pass: null,
        reason: "not a qualification case",
        note: fixture.note,
      });
      continue;
    }

    try {
      const run = await runIntake(fixture.transcript);
      const { result } = applyGuardrails(run.result);
      rows.push({
        id: fixture.id,
        expected: fixture.expectedVerdict,
        actual: result.verdict,
        pass: result.verdict === fixture.expectedVerdict,
        reason: result.verdict_reason,
        note: fixture.note,
      });
    } catch (err) {
      rows.push({
        id: fixture.id,
        expected: fixture.expectedVerdict,
        actual: null,
        pass: false,
        reason: "",
        note: fixture.note,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return rows;
}

export default async function ReplayPage() {
  const rows = await runReplay();
  const scored = rows.filter((r) => r.pass !== null);
  const passCount = scored.filter((r) => r.pass).length;

  return (
    <main className="mx-auto max-w-4xl flex-1 p-6 flex flex-col gap-6 w-full">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Phase 8 — replay against real transcripts</h1>
        <nav className="flex gap-3 text-sm">
          <Link href="/" className="underline">Call simulator</Link>
          <Link href="/dashboard" className="underline">Dashboard</Link>
        </nav>
      </header>
      <p className="text-sm text-gray-500">
        {passCount}/{scored.length} fixtures matched the expected verdict. Two cases (T10,
        T14) are expected to diverge from what the real front desk did — that divergence is
        intentional, see the note on each.
      </p>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left border-b border-gray-300">
            <th className="py-2 pr-2">ID</th>
            <th className="py-2 pr-2">Expected</th>
            <th className="py-2 pr-2">Actual</th>
            <th className="py-2 pr-2">Result</th>
            <th className="py-2 pr-2">Reasoning / note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-gray-100 align-top">
              <td className="py-2 pr-2 font-mono">{row.id}</td>
              <td className="py-2 pr-2">{row.expected ?? "—"}</td>
              <td className="py-2 pr-2">{row.actual ?? (row.error ? "error" : "—")}</td>
              <td className="py-2 pr-2">
                {row.pass === null ? (
                  <span className="text-gray-400">n/a</span>
                ) : row.pass ? (
                  <span className="text-green-700">pass</span>
                ) : (
                  <span className="text-red-700">mismatch</span>
                )}
              </td>
              <td className="py-2 pr-2 text-gray-600">
                {row.error ?? row.reason}
                {row.note && <div className="text-xs text-gray-400 mt-1">{row.note}</div>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
