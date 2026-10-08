import "server-only";
import type { CallRecord, Verdict } from "./types";

// Known gap: the text simulator captures no phone/email, which would normally be the
// dedup key for a contact. Every call creates a new HubSpot contact rather than updating
// a returning caller's record — a real phone system would key off caller ID instead.

const HUBSPOT_API = "https://api.hubapi.com";
const DEAL_PIPELINE = "default";
const DEAL_STAGE_INQUIRY = "4414728905"; // "Inquiry" stage in the default Sales Pipeline

const VERDICT_TO_HUBSPOT: Record<Verdict, string> = {
  approved: "approved",
  hard_declined: "declined",
  flagged: "flagged",
  routed_existing_client: "escalated",
};

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

    const contact = await hubspotFetch("/crm/v3/objects/contacts", {
      method: "POST",
      body: JSON.stringify({
        properties: {
          firstname,
          lastname,
          location: call.location,
          carpet_area_sq_ft: call.carpet_area_sqft,
          project_scope: call.project_scope,
          timeline: call.timeline,
          decision_maker_confirmed: call.is_decision_maker === null ? undefined : String(call.is_decision_maker),
          referral_source: call.referral_source,
          call_verdict: VERDICT_TO_HUBSPOT[call.verdict],
        },
      }),
    });

    const contact_id: string = contact.id;
    let deal_id: string | null = null;

    if (call.verdict === "approved") {
      const deal = await hubspotFetch("/crm/v3/objects/deals", {
        method: "POST",
        body: JSON.stringify({
          properties: {
            dealname: `${call.caller_name ?? "Unknown caller"} — ${call.project_scope ?? "project"} (${call.location ?? "location TBD"})`,
            pipeline: DEAL_PIPELINE,
            dealstage: DEAL_STAGE_INQUIRY,
          },
          associations: [
            {
              to: { id: contact_id },
              types: [
                {
                  associationCategory: "HUBSPOT_DEFINED",
                  associationTypeId: 3, // deal_to_contact
                },
              ],
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
