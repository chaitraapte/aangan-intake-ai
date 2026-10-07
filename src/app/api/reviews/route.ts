import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendHandoffNote } from "@/lib/telegram";

// Front desk resolves a flagged call: approve (sends handoff) or decline (closes it out).
// This is the human-owned step the locked decisions require for every soft judgment call —
// the AI never reaches a final decline on its own.
export async function POST(req: Request) {
  const body = await req.json();
  const { call_id, final_decision, reviewer_note } = body as {
    call_id?: string;
    final_decision?: "approved" | "declined";
    reviewer_note?: string;
  };

  if (!call_id || (final_decision !== "approved" && final_decision !== "declined")) {
    return NextResponse.json({ error: "Missing call_id or invalid final_decision." }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { data: call, error: fetchError } = await supabase
    .from("calls")
    .select("*")
    .eq("id", call_id)
    .single();

  if (fetchError || !call) {
    return NextResponse.json({ error: "Call not found." }, { status: 404 });
  }

  // The AI's lean on a flagged call is implicit (it only flags, never approves or declines),
  // so any resolution here counts as the human making the actual first decision — that's
  // the point of the review step, not an "override" in the override-rate sense. We still
  // record it as overrode_ai when the AI's own reasoning clearly leaned one way and the
  // human went the other, using a simple heuristic on the stored verdict_reason tone is out
  // of scope for this build; for now overrode_ai reflects whether the final call differs
  // from what a flagged call defaults to (decline), i.e. an approval overrides the cautious
  // default.
  const overrode_ai = final_decision === "approved";

  const { data: review, error: reviewError } = await supabase
    .from("reviews")
    .insert({
      call_id,
      final_decision,
      overrode_ai,
      reviewer_note: reviewer_note ?? null,
    })
    .select()
    .single();

  if (reviewError) {
    return NextResponse.json({ error: `Supabase insert failed: ${reviewError.message}` }, { status: 500 });
  }

  const newVerdict = final_decision === "approved" ? "approved" : "hard_declined";
  let handoff_sent = call.handoff_sent;

  if (final_decision === "approved") {
    const note = `Reviewed & approved by front desk.\nLocation: ${call.location ?? "unknown"}\nScope: ${call.project_scope ?? "unknown"}\nTimeline: ${call.timeline ?? "unknown"}\nReviewer note: ${reviewer_note ?? "none"}`;
    const handoff = await sendHandoffNote(note);
    handoff_sent = handoff.sent;
  }

  const { error: updateError } = await supabase
    .from("calls")
    .update({ verdict: newVerdict, handoff_sent })
    .eq("id", call_id);

  if (updateError) {
    return NextResponse.json({ error: `Supabase update failed: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ review, handoff_sent });
}
