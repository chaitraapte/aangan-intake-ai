import { NextResponse } from "next/server";
import { runIntake } from "@/lib/gemini";
import { applyGuardrails } from "@/lib/guardrails";
import { sendHandoffNote } from "@/lib/telegram";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.json();
  const transcript = typeof body.transcript === "string" ? body.transcript.trim() : "";

  if (!transcript) {
    return NextResponse.json({ error: "Missing transcript." }, { status: 400 });
  }

  let run;
  try {
    run = await runIntake(transcript);
  } catch (err) {
    return NextResponse.json(
      { error: `Gemini call failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  const { result, guardrail_triggered, guardrail_notes } = applyGuardrails(run.result);

  let handoff_sent = false;
  if (result.verdict === "approved" && result.handoff_note) {
    const handoff = await sendHandoffNote(result.handoff_note);
    handoff_sent = handoff.sent;
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("calls")
    .insert({
      transcript,
      call_type: result.call_type,
      location: result.extracted.location,
      carpet_area_sqft: result.extracted.carpet_area_sqft,
      project_scope: result.extracted.project_scope,
      timeline: result.extracted.timeline,
      is_decision_maker: result.extracted.is_decision_maker,
      referral_source: result.extracted.referral_source,
      verdict: result.verdict,
      verdict_reason: result.verdict_reason,
      handoff_sent,
      guardrail_triggered,
      input_tokens: run.input_tokens,
      output_tokens: run.output_tokens,
      cost_usd: run.cost_usd,
      response_seconds: run.response_seconds,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: `Supabase insert failed: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({
    call: data,
    caller_reply: result.caller_reply,
    handoff_note: result.handoff_note,
    hard_decline_reason: result.hard_decline_reason,
    guardrail_triggered,
    guardrail_notes,
  });
}
