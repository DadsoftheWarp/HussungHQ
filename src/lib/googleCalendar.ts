import { CalendarEvent } from "@/types";
import { format, subMonths, addMonths } from "date-fns";

// ── Types from Google Calendar API ──────────────────────────────────────────

interface GCalDateTime {
  date?: string;       // all-day: "YYYY-MM-DD"
  dateTime?: string;   // timed: ISO 8601
  timeZone?: string;
}

export interface GCalEvent {
  id: string;
  summary?: string;
  description?: string;
  start: GCalDateTime;
  end: GCalDateTime;
  status?: string;
  colorId?: string;
}

// ── Sync date range: 2 months back → 6 months forward ───────────────────────

export function syncRange() {
  const now = new Date();
  return {
    timeMin: subMonths(now, 2).toISOString(),
    timeMax: addMonths(now, 6).toISOString(),
  };
}

// ── Fetch events from Google Calendar ───────────────────────────────────────

export async function fetchGoogleEvents(accessToken: string): Promise<GCalEvent[]> {
  const { timeMin, timeMax } = syncRange();
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "500",
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error(`Google Calendar fetch failed: ${res.status}`);

  const data = await res.json();
  return (data.items ?? []).filter((e: GCalEvent) => e.status !== "cancelled");
}

// ── Create an event in Google Calendar ──────────────────────────────────────

const RRULE_MAP: Record<string, string> = {
  weekly:   "RRULE:FREQ=WEEKLY",
  biweekly: "RRULE:FREQ=WEEKLY;INTERVAL=2",
  monthly:  "RRULE:FREQ=MONTHLY",
  yearly:   "RRULE:FREQ=YEARLY",
};

export async function createGoogleEvent(
  accessToken: string,
  event: Pick<CalendarEvent, "title" | "date" | "time" | "endTime" | "allDay" | "description" | "recurring">
): Promise<string> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dateOnly = event.date.substring(0, 10);

  const body: Record<string, unknown> = {
    summary: event.title,
    description: event.description ?? "",
  };

  if (event.allDay) {
    body.start = { date: dateOnly };
    body.end = { date: dateOnly };
  } else {
    const startTime = event.time ?? "00:00";
    const endTime = event.endTime ?? format(
      new Date(`${dateOnly}T${event.time ?? "00:00"}`),
      "HH:mm"
    );
    body.start = { dateTime: `${dateOnly}T${startTime}:00`, timeZone: tz };
    body.end = { dateTime: `${dateOnly}T${endTime}:00`, timeZone: tz };
  }

  if (event.recurring && event.recurring !== "none" && RRULE_MAP[event.recurring]) {
    body.recurrence = [RRULE_MAP[event.recurring]];
  }

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (res.status === 401) throw new Error("UNAUTHORIZED");
  if (!res.ok) throw new Error(`Google Calendar create failed: ${res.status}`);

  const data = await res.json();
  return data.id as string;
}

// ── Delete an event from Google Calendar ────────────────────────────────────

export async function deleteGoogleEvent(
  accessToken: string,
  googleEventId: string
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  // 404 = already gone, that's fine
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    if (res.status === 401) throw new Error("UNAUTHORIZED");
    throw new Error(`Google Calendar delete failed: ${res.status}`);
  }
}

// ── Convert a Google event → our CalendarEvent format ───────────────────────

export function gCalEventToAppEvent(
  gEvent: GCalEvent,
  syncedBy: string
): Omit<CalendarEvent, "id"> {
  const allDay = !!gEvent.start.date;
  const rawStart = gEvent.start.date ?? gEvent.start.dateTime ?? "";
  const rawEnd = gEvent.end.date ?? gEvent.end.dateTime ?? "";

  // Extract HH:MM from dateTime strings
  const time = !allDay && gEvent.start.dateTime
    ? gEvent.start.dateTime.substring(11, 16)
    : undefined;
  const endTime = !allDay && gEvent.end.dateTime
    ? gEvent.end.dateTime.substring(11, 16)
    : undefined;

  // Firestore does not accept undefined — build the object without undefined fields
  const event: Record<string, unknown> = {
    title: gEvent.summary ?? "(No title)",
    date: allDay ? `${rawStart}T00:00:00.000Z` : rawStart,
    endDate: allDay ? `${rawEnd}T00:00:00.000Z` : rawEnd,
    allDay,
    description: gEvent.description ?? "",
    createdBy: syncedBy,
    color: "#4285F4",
    source: "google",
    googleEventId: gEvent.id,
    syncedBy,
  };
  if (time !== undefined) event.time = time;
  if (endTime !== undefined) event.endTime = endTime;

  return event as Omit<CalendarEvent, "id">;
}
