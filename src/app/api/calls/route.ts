import { NextResponse } from "next/server";
import { runIntake } from "@/lib/gemini";
import { applyGuardrails } from "@/lib/guardrails";
import { sendHandoffNote } from "@/lib/telegram";
import { queryOne } from "@/lib/db";
import type { CallRecord } from "@/lib/types";

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

  // Every call gets a handoff note, with no exceptions, including declines and escalations
  // — override rule 5. All land in the same Telegram chat for this single-studio demo; the
  // status prefix (APPROVED / DECLINED — <reason> / FLAG — <reason> / URGENT — ESCALATE)
  // is what distinguishes them.
  const handoff = await sendHandoffNote(result.handoff_note);
  const handoff_sent = handoff.sent;

  let data: CallRecord | null;
  try {
    data = await queryOne<CallRecord>(
      `insert into calls (
        transcript, call_type, location, carpet_area_sqft, project_scope, timeline,
        is_decision_maker, referral_source, verdict, verdict_reason, callback_window,
        named_senior_request, handoff_sent, guardrail_triggered, input_tokens,
        output_tokens, cost_usd, response_seconds
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      returning *`,
      [
        transcript,
        result.call_type,
        result.extracted.location,
        result.extracted.carpet_area_sqft,
        result.extracted.project_scope,
        result.extracted.timeline,
        result.extracted.is_decision_maker,
        result.extracted.referral_source,
        result.verdict,
        result.verdict_reason,
        result.callback_window,
        result.named_senior_request,
        handoff_sent,
        guardrail_triggered,
        run.input_tokens,
        run.output_tokens,
        run.cost_usd,
        run.response_seconds,
      ]
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Database insert failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
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
