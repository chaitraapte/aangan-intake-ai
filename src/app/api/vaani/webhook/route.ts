import { NextResponse } from "next/server";
import { processCall } from "@/lib/process-call";

// Vaani fires this for every call lifecycle event (call_started, call_ringing,
// human_transfer_*, call_ended, call_postprocessing, ...). We only act on
// call_postprocessing — the one event that carries the finished transcript — and
// acknowledge everything else with a quiet 200 so Vaani doesn't retry them as failures.
// See https://docs.vaanivoice.ai/guides/webhook-setup for the full event/payload reference.

interface VaaniPostprocessingPayload {
  event: string;
  call_id?: string;
  data?: {
    call_id?: string;
    transcript?: string;
    recording_url?: string;
  };
}

export async function POST(req: Request) {
  let payload: VaaniPostprocessingPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (payload.event !== "call_postprocessing") {
    return NextResponse.json({ status: "ignored", event: payload.event });
  }

  const transcript = payload.data?.transcript?.trim();
  if (!transcript) {
    // Acknowledge anyway — a malformed postprocessing event is Vaani's problem to debug
    // via their own logs, not something worth retrying our side over.
    return NextResponse.json({ status: "no_transcript" });
  }

  try {
    const result = await processCall(transcript, {
      vaaniCallId: payload.data?.call_id ?? payload.call_id ?? null,
      vaaniRecordingUrl: payload.data?.recording_url ?? null,
    });
    return NextResponse.json({ status: "processed", verdict: result.call?.verdict ?? null });
  } catch (err) {
    // Still 200 — once the call's over, Vaani can't retry it meaningfully (there's no
    // caller on the line anymore), so surfacing a failure here just risks it hammering a
    // dead endpoint. Log loudly instead so it shows up wherever this process's stdout goes.
    console.error("[vaani webhook] processCall failed:", err);
    return NextResponse.json({ status: "error", error: err instanceof Error ? err.message : String(err) });
  }
}
