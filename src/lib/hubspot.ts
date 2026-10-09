import "server-only";
import type { CallRecord, Verdict } from "./types";

// HubSpot is the FOUNDER's view: sales funnel only — how many leads, how many declined,
// what's the pipeline worth. It deliberately does NOT hold project detail (transcript,
// sq ft, scope, budget, scheduled time) — that's the designer's working data and lives in
// our own app instead (see /). Splitting it this way was an explicit correction from
// the original design, which had put all the detail into HubSpot.

const HUBSPOT_API = "https://api.hubapi.com";
const DEAL_PIPELINE = "default";

const STAGE_INQUIRY = "4414728905"; // new lead, not yet qualified
const STAGE_NEEDS_ASSESSMENT = "4414728906"; // qualified, consultation in motion
const STAGE_CLOSED_LOST = "closedlost";

// Internal estimate only — the mid-point of pricing.md's "Standard specification"
// residential range (₹1,800–2,400/sq ft). Never shown to a caller; HubSpot deal amounts
// are exactly the kind of backend-only figure that rule was always about, the same way
// budget_signal is logged without ever being spoken aloud.
const ESTIMATED_RATE_PER_SQFT = 2100;

const VERDICT_TO_CONTACT_STATUS: Record<Verdict, string> = {
  approved: "approved",
  hard_declined: "declined",
  flagged: "flagged",
  routed_existing_client: "escalated",
};

function dealStageFor(verdict: Verdict): string | null {
  switch (verdict) {
    case "approved":
      return STAGE_NEEDS_ASSESSMENT;
    case "flagged":
      return STAGE_INQUIRY;
    case "hard_declined":
      return STAGE_CLOSED_LOST;
    case "routed_existing_client":
      return null; // not a new lead — no deal
  }
}

function estimateDealAmount(carpetAreaSqft: number | null): number | undefined {
  if (!carpetAreaSqft) return undefined;
  return carpetAreaSqft * ESTIMATED_RATE_PER_SQFT;
}

// Board-view color-coding: HubSpot colors deal cards by this field's option, not by the
// raw amount, so we classify into a tier once here rather than asking HubSpot to threshold
// a number. Thresholds are arbitrary but reasonable given our ₹2,100/sqft estimate (a small
// 1-room job lands Low, a typical full-home 2-3BHK lands Medium, a villa/large commercial
// fit-out lands High).
function revenueTierFor(amount: number | undefined): "high" | "medium" | "low" | "unknown" {
  if (amount === undefined) return "unknown";
  if (amount >= 5_000_000) return "high"; // ≥ ₹50L
  if (amount >= 1_500_000) return "medium"; // ₹15L–50L
  return "low"; // < ₹15L
}

async function hubspotFetch(path: string, init: RequestInit) {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) throw new Error("Missing HUBSPOT_ACCESS_TOKEN env var.");

  const res = await fetch(`${HUBSPOT_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!res.ok) {
    throw new Error(`HubSpot ${path} failed (${res.status}): ${await res.text()}`);
  }

  return res.json();
}

// Dedup by email first, then phone — a returning caller who gives either gets their
// existing contact updated instead of a duplicate created.
async function findExistingContactId(email: string | null, phone: string | null): Promise<string | null> {
  const propertyName = email ? "email" : phone ? "phone" : null;
  const value = email ?? phone;
  if (!propertyName || !value) return null;

  const result = await hubspotFetch("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [{ filters: [{ propertyName, operator: "EQ", value }] }],
      limit: 1,
    }),
  });

  return result.results?.[0]?.id ?? null;
}

export interface HubSpotSyncResult {
  contact_id: string | null;
  deal_id: string | null;
  error: string | null;
}

export async function syncCallToHubSpot(call: CallRecord): Promise<HubSpotSyncResult> {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    return { contact_id: null, deal_id: null, error: null };
  }

  try {
    const [firstname, ...rest] = (call.caller_name ?? "Unknown caller").split(" ");
    const lastname = rest.join(" ") || "—";

    // Identity + funnel status only — no project detail. That lives in our own app.
    const properties = {
      firstname,
      lastname,
      email: call.caller_email ?? undefined,
      phone: call.caller_phone ?? undefined,
      call_verdict: VERDICT_TO_CONTACT_STATUS[call.verdict],
    };

    const existingId = await findExistingContactId(call.caller_email, call.caller_phone);

    const contact = existingId
      ? await hubspotFetch(`/crm/v3/objects/contacts/${existingId}`, {
          method: "PATCH",
          body: JSON.stringify({ properties }),
        })
      : await hubspotFetch("/crm/v3/objects/contacts", {
          method: "POST",
          body: JSON.stringify({ properties }),
        });

    const contact_id: string = contact.id;
    let deal_id: string | null = null;

    const dealstage = dealStageFor(call.verdict);
    if (dealstage) {
      const amount = estimateDealAmount(call.carpet_area_sqft);
      const deal = await hubspotFetch("/crm/v3/objects/deals", {
        method: "POST",
        body: JSON.stringify({
          properties: {
            dealname: `${call.caller_name ?? "Unknown caller"} (${call.location ?? "location TBD"})`,
            pipeline: DEAL_PIPELINE,
            dealstage,
            amount: amount !== undefined ? String(amount) : undefined,
            revenue_tier: revenueTierFor(amount),
          },
          associations: [
            {
              to: { id: contact_id },
              types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 3 }], // deal_to_contact
            },
          ],
        }),
      });
      deal_id = deal.id;
    }

    return { contact_id, deal_id, error: null };
  } catch (err) {
    return {
      contact_id: null,
      deal_id: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Called when the front desk resolves a flagged call — moves the deal from Inquiry to
// either Needs Assessment (approved) or Closed Lost (declined), and updates the contact's
// status the same way the original sync would have if the verdict had been clear from the
// start.
export async function updateHubSpotAfterReview(
  contactId: string | null,
  dealId: string | null,
  finalDecision: "approved" | "declined"
): Promise<{ error: string | null }> {
  if (!process.env.HUBSPOT_ACCESS_TOKEN) return { error: null };

  try {
    const verdict: Verdict = finalDecision === "approved" ? "approved" : "hard_declined";

    if (contactId) {
      await hubspotFetch(`/crm/v3/objects/contacts/${contactId}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: { call_verdict: VERDICT_TO_CONTACT_STATUS[verdict] } }),
      });
    }

    if (dealId) {
      const dealstage = dealStageFor(verdict);
      await hubspotFetch(`/crm/v3/objects/deals/${dealId}`, {
        method: "PATCH",
        body: JSON.stringify({ properties: { dealstage } }),
      });
    }

    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
