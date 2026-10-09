"use client";

import { useState } from "react";
import Link from "next/link";

interface CallApiResponse {
  call?: { id: string; verdict: string; guardrail_triggered: boolean };
  caller_reply?: string;
  handoff_note?: string | null;
  hard_decline_reason?: string | null;
  guardrail_triggered?: boolean;
  guardrail_notes?: string[];
  error?: string;
}

const VERDICT_LABEL: Record<string, string> = {
  approved: "Approved",
  hard_declined: "Hard declined",
  flagged: "Flagged for review",
  routed_existing_client: "Routed — existing client",
};

export default function Home() {
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CallApiResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!transcript.trim()) return;
    setLoading(true);
    setResponse(null);
    try {
      const res = await fetch("/api/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setResponse({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl flex-1 p-6 flex flex-col gap-6 w-full">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Aangan intake AI — call simulator</h1>
          <p className="text-sm text-gray-500">
            Phone channel only. Type what a caller would say on this call.
          </p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link href="/leads" className="underline">Leads</Link>
          <Link href="/review" className="underline">Review queue</Link>
          <Link href="/dashboard" className="underline">Dashboard</Link>
        </nav>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <textarea
          className="w-full rounded border border-gray-300 p-3 min-h-40 font-mono text-sm"
          placeholder="e.g. Hi, I'm Priya. We have a 3BHK in Kothrud, 1,400 sq ft, want a full redesign — kitchen, living room, both bedrooms. Timeline is March, no rush. I'm the owner, my husband's on board too."
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading}
          className="self-start rounded bg-black px-4 py-2 text-white text-sm disabled:opacity-50"
        >
          {loading ? "Thinking..." : "Submit call"}
        </button>
      </form>

      {response && (
        <section className="rounded border border-gray-200 p-4 flex flex-col gap-3 text-sm">
          {response.error ? (
            <p className="text-red-600">{response.error}</p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Verdict:</span>
                <span>{VERDICT_LABEL[response.call?.verdict ?? ""] ?? response.call?.verdict}</span>
                {response.guardrail_triggered && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800 text-xs">
                    guardrail intervened
                  </span>
                )}
              </div>
              <div>
                <span className="font-semibold">What the caller hears:</span>
                <p className="mt-1">{response.caller_reply}</p>
              </div>
              {response.handoff_note && (
                <div>
                  <span className="font-semibold">Handoff note (every call gets one):</span>
                  <pre className="mt-1 whitespace-pre-wrap">{response.handoff_note}</pre>
                </div>
              )}
              {response.guardrail_notes && response.guardrail_notes.length > 0 && (
                <div>
                  <span className="font-semibold">Guardrail notes:</span>
                  <ul className="mt-1 list-disc pl-5">
                    {response.guardrail_notes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
