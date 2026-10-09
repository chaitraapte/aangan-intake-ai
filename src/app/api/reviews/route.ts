import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { sendHandoffNote } from "@/lib/telegram";
import { updateHubSpotAfterReview } from "@/lib/hubspot";
import type { CallRecord } from "@/lib/types";

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

  const call = await queryOne<CallRecord>("select * from calls where id = $1", [call_id]);

  if (!call) {
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

  let review;
  try {
    review = await queryOne(
      `insert into reviews (call_id, final_decision, overrode_ai, reviewer_note)
       values ($1,$2,$3,$4) returning *`,
      [call_id, final_decision, overrode_ai, reviewer_note ?? null]
    );
  } catch (err) {
    return NextResponse.json(
      { error: `Database insert failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }

  const newVerdict = final_decision === "approved" ? "approved" : "hard_declined";
  let handoff_sent = call.handoff_sent;

  if (final_decision === "approved") {
    const note = `Reviewed & approved by front desk.\nLocation: ${call.location ?? "unknown"}\nScope: ${call.project_scope ?? "unknown"}\nTimeline: ${call.timeline ?? "unknown"}\nReviewer note: ${reviewer_note ?? "none"}`;
    const handoff = await sendHandoffNote(note);
    handoff_sent = handoff.sent;
  }

  // Move the HubSpot deal from Inquiry to Needs Assessment or Closed Lost — the founder's
  // funnel view should reflect the human's call, not stay stuck wherever the AI left it.
  await updateHubSpotAfterReview(call.hubspot_contact_id, call.hubspot_deal_id, final_decision);

  try {
    await query("update calls set verdict = $1, handoff_sent = $2 where id = $3", [
      newVerdict,
      handoff_sent,
      call_id,
    ]);
  } catch (err) {
    return NextResponse.json(
      { error: `Database update failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ review, handoff_sent });
}
