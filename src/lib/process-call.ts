import "server-only";
import { runIntake } from "./gemini";
import { applyGuardrails } from "./guardrails";
import { sendHandoffNote } from "./telegram";
import { syncCallToHubSpot } from "./hubspot";
import { bookConsultation } from "./calendar";
import { queryOne } from "./db";
import type { CallRecord } from "./types";

// The single pipeline every call goes through, regardless of source — the text simulator
// (/api/calls) and real inbound calls via Vaani's call_postprocessing webhook
// (/api/vaani/webhook) both call this with nothing but a transcript. Everything else
// (qualification, guardrails, HubSpot, Calendar, Telegram) is identical either way.

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

export interface ProcessCallOptions {
  vaaniCallId?: string | null;
  vaaniRecordingUrl?: string | null;
}

export interface ProcessCallResult {
  call: CallRecord | null;
  caller_reply: string;
  handoff_note: string;
  hard_decline_reason: string | null;
  guardrail_triggered: boolean;
  guardrail_notes: string[];
  hubspot: Awaited<ReturnType<typeof syncCallToHubSpot>>;
}

export async function processCall(
  transcript: string,
  opts: ProcessCallOptions = {}
): Promise<ProcessCallResult> {
  const run = await runIntake(transcript);
  const { result, guardrail_triggered, guardrail_notes } = applyGuardrails(run.result);

  let data = await queryOne<CallRecord>(
    `insert into calls (
      transcript, call_type, caller_name, caller_phone, caller_email, location,
      carpet_area_sqft, project_scope, timeline, is_decision_maker, referral_source,
      budget_signal, preferred_consultation_mode, verdict, verdict_reason,
      callback_window, named_senior_request, handoff_sent, guardrail_triggered,
      input_tokens, output_tokens, cost_usd, response_seconds, vaani_call_id,
      vaani_recording_url
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
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
      opts.vaaniCallId ?? null,
      opts.vaaniRecordingUrl ?? null,
    ]
  );

  let hubspot: Awaited<ReturnType<typeof syncCallToHubSpot>> = {
    contact_id: null,
    deal_id: null,
    error: null,
  };
  let caller_reply = result.caller_reply;
  let handoff_note = result.handoff_note;

  if (data) {
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

    // Booking happens before the HubSpot sync (not after) so the deal's priority — derived
    // from the same urgency logic as the Leads page — reflects the real consultation time
    // instead of being computed before it existed.
    hubspot = await syncCallToHubSpot({ ...data, consultation_slot });

    const handoff = await sendHandoffNote(handoff_note);

    data = await queryOne<CallRecord>(
      `update calls set hubspot_contact_id = $1, hubspot_deal_id = $2, calendar_event_id = $3,
         consultation_slot = $4, handoff_sent = $5
       where id = $6 returning *`,
      [hubspot.contact_id, hubspot.deal_id, calendar_event_id, consultation_slot, handoff.sent, data.id]
    );
  }

  return {
    call: data,
    caller_reply,
    handoff_note,
    hard_decline_reason: result.hard_decline_reason,
    guardrail_triggered,
    guardrail_notes,
    hubspot,
  };
}
