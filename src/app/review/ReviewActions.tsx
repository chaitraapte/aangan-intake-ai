"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReviewActions({ callId }: { callId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function resolve(final_decision: "approved" | "declined") {
    setLoading(true);
    try {
      await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ call_id: callId, final_decision, reviewer_note: note || null }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <input
        className="rounded border border-gray-300 p-2"
        placeholder="Reviewer note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <button
          disabled={loading}
          onClick={() => resolve("approved")}
          className="rounded bg-black px-3 py-1.5 text-white disabled:opacity-50"
        >
          Approve
        </button>
        <button
          disabled={loading}
          onClick={() => resolve("declined")}
          className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
