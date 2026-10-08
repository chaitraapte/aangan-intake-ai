import { NextResponse } from "next/server";
import { runIntake } from "@/lib/gemini";
import { applyGuardrails } from "@/lib/guardrails";
import { sendHandoffNote } from "@/lib/telegram";
import { syncCallToHubSpot } from "@/lib/hubspot";
import { bookConsultation } from "@/lib/calendar";
import { queryOne } from "@/lib/db";
import type { CallRecord } from "@/lib/types";

function formatSlot(date: Date): string {
  return date.toLocaleString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

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

  let data: CallRecord | null;
  try {
    data = await queryOne<CallRecord>(
      `insert into calls (
        transcript, call_type, caller_name, caller_phone, caller_email, location,
        carpet_area_sqft, project_scope, timeline, is_decision_maker, referral_source,
        budget_signal, preferred_consultation_mode, verdict, verdict_reason,
        callback_window, named_senior_request, handoff_sent, guardrail_triggered,
        input_tokens, output_tokens, cost_usd, response_seconds
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)
      returning *`,
      [
        transcript,
        result.call_type,
        result.extracted.caller_name,
        result.extracted.caller_phone,
        result.extracted.caller_email,
        result.extracted.location,
        result.extracted.carpet_area_sqft,
        result.extracted.project_scope,
        result.extracted.timeline,
        result.extracted.is_decision_maker,
        result.extracted.referral_source,
        result.extracted.budget_signal,
        result.extracted.preferred_consultation_mode,
        result.verdict,
        result.verdict_reason,
        result.callback_window,
        result.named_senior_request,
        false, // handoff_sent — set after the note (possibly with the booked slot) is sent below
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

  let hubspot: Awaited<ReturnType<typeof syncCallToHubSpot>> = {
    contact_id: null,
    deal_id: null,
    error: null,
  };
  let caller_reply = result.caller_reply;
  let handoff_note = result.handoff_note;

  if (data) {
    hubspot = await syncCallToHubSpot(data);

    // Book the consultation slot for real, against the live "aangan" calendar — [get_availability]
    // + [book_consultation] from the Vaani spec, done here since the text simulator can't hold a
    // second turn to let the caller pick a slot. Picks the earliest open business-hours slot.
    let calendar_event_id: string | null = null;
    let consultation_slot: string | null = null;
    if (result.verdict === "approved") {
      const booking = await bookConsultation({
        summary: `Consultation — ${result.extracted.caller_name ?? "Unknown caller"} (${result.extracted.location ?? "location TBD"})`,
        description: handoff_note,
        attendeeEmail: result.extracted.caller_email,
      });
      if (booking.slot) {
        calendar_event_id = booking.event_id;
        consultation_slot = booking.slot.start.toISOString();
        const formatted = formatSlot(booking.slot.start);
        caller_reply += ` I've gone ahead and booked your consultation for ${formatted}.`;
        handoff_note += `\nConsultation booked: ${formatted}`;
      } else if (booking.error) {
        handoff_note += `\nConsultation booking failed: ${booking.error}`;
      }
    }

    const handoff = await sendHandoffNote(handoff_note);

    data = await queryOne<CallRecord>(
      `update calls set hubspot_contact_id = $1, hubspot_deal_id = $2, calendar_event_id = $3,
         consultation_slot = $4, handoff_sent = $5
       where id = $6 returning *`,
      [hubspot.contact_id, hubspot.deal_id, calendar_event_id, consultation_slot, handoff.sent, data.id]
    );
  }

  return NextResponse.json({
    call: data,
    caller_reply,
    handoff_note,
    hard_decline_reason: result.hard_decline_reason,
    guardrail_triggered,
    guardrail_notes,
    hubspot,
  });
}
