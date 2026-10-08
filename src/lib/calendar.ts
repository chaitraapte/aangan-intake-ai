import "server-only";
import { google } from "googleapis";

const TIMEZONE = "Asia/Kolkata";
const BUSINESS_START_HOUR = 10;
const BUSINESS_END_HOUR = 19;
const SLOT_MINUTES = 60;

function getOAuthClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing GOOGLE_OAUTH_* env vars.");
  }

  const client = new google.auth.OAuth2(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

function getCalendarId(): string {
  const id = process.env.GOOGLE_CALENDAR_ID;
  if (!id) throw new Error("Missing GOOGLE_CALENDAR_ID env var.");
  return id;
}

export interface Slot {
  start: Date;
  end: Date;
}

// Candidate business-hour slots over the next `daysAhead` days (skipping Sundays),
// then filtered against the calendar's actual busy times via freebusy.query.
export async function getAvailability(daysAhead = 10, maxSlots = 3): Promise<Slot[]> {
  const auth = getOAuthClient();
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = getCalendarId();

  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  const freebusy = await calendar.freebusy.query({
    requestBody: { timeMin, timeMax, timeZone: TIMEZONE, items: [{ id: calendarId }] },
  });

  const busy = (freebusy.data.calendars?.[calendarId]?.busy ?? []).map((b) => ({
    start: new Date(b.start!),
    end: new Date(b.end!),
  }));

  const candidates: Slot[] = [];
  for (let day = 0; day < daysAhead && candidates.length < maxSlots * 4; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() + day);
    if (date.getDay() === 0) continue; // skip Sunday

    for (let hour = BUSINESS_START_HOUR; hour < BUSINESS_END_HOUR; hour++) {
      const start = new Date(date);
      start.setHours(hour, 0, 0, 0);
      if (start <= now) continue;
      const end = new Date(start.getTime() + SLOT_MINUTES * 60 * 1000);

      const overlaps = busy.some((b) => start < b.end && end > b.start);
      if (!overlaps) candidates.push({ start, end });
    }
  }

  return candidates.slice(0, maxSlots);
}

export interface BookingResult {
  event_id: string | null;
  slot: Slot | null;
  error: string | null;
}

export async function bookConsultation(opts: {
  summary: string;
  description: string;
  attendeeEmail?: string | null;
}): Promise<BookingResult> {
  if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    return { event_id: null, slot: null, error: null };
  }

  try {
    const slots = await getAvailability(10, 1);
    const slot = slots[0];
    if (!slot) {
      return { event_id: null, slot: null, error: "No availability found in the next 10 days." };
    }

    const auth = getOAuthClient();
    const calendar = google.calendar({ version: "v3", auth });

    const event = await calendar.events.insert({
      calendarId: getCalendarId(),
      requestBody: {
        summary: opts.summary,
        description: opts.description,
        start: { dateTime: slot.start.toISOString(), timeZone: TIMEZONE },
        end: { dateTime: slot.end.toISOString(), timeZone: TIMEZONE },
        attendees: opts.attendeeEmail ? [{ email: opts.attendeeEmail }] : undefined,
      },
    });

    return { event_id: event.data.id ?? null, slot, error: null };
  } catch (err) {
    return {
      event_id: null,
      slot: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
