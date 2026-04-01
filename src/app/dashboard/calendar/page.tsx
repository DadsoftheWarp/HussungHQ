"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection, addDoc, deleteDoc, doc, onSnapshot,
  query, orderBy, writeBatch, getDocs, where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { CalendarEvent } from "@/types";
import {
  fetchGoogleEvents, createGoogleEvent, deleteGoogleEvent,
  gCalEventToAppEvent,
} from "@/lib/googleCalendar";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, addMonths, subMonths, parseISO, isToday, isSameDay,
} from "date-fns";
import {
  Plus, ChevronLeft, ChevronRight, X, Clock, Trash2,
  RefreshCw, CalendarCheck, AlertCircle, Unlink, Repeat,
} from "lucide-react";
import { doesEventOccurOn, RECURRENCE_OPTIONS, RECURRENCE_LABELS } from "@/lib/calendarUtils";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444"];

export default function CalendarPage() {
  const { familyId, user, googleCalendarToken, googleCalendarConnected, connectGoogleCalendar, disconnectGoogleCalendar } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [form, setForm] = useState({
    title: "", time: "", endTime: "", allDay: true, description: "", color: COLORS[0],
    recurring: "none" as CalendarEvent["recurring"],
  });

  // ── Live Firestore listener ───────────────────────────────────────────────
  useEffect(() => {
    if (!familyId) return;
    const q = query(collection(db, "families", familyId, "events"), orderBy("date"));
    return onSnapshot(q, (snap) => {
      setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CalendarEvent)));
    });
  }, [familyId]);

  // ── Google Calendar sync ──────────────────────────────────────────────────
  const syncGoogleCalendar = useCallback(async (silent = false) => {
    if (!googleCalendarToken || !familyId || !user) return;
    if (!silent) setSyncing(true);
    setSyncError(null);

    try {
      const gEvents = await fetchGoogleEvents(googleCalendarToken);

      // Get existing Google-sourced events for this user from Firestore
      const existingSnap = await getDocs(
        query(
          collection(db, "families", familyId, "events"),
          where("source", "==", "google"),
          where("syncedBy", "==", user.uid)
        )
      );

      const batch = writeBatch(db);

      // Build a map of googleEventId → Firestore doc id for existing synced events
      const existingMap = new Map<string, string>();
      existingSnap.docs.forEach((d) => {
        const data = d.data() as CalendarEvent;
        if (data.googleEventId) existingMap.set(data.googleEventId, d.id);
      });

      // Upsert events from Google
      const seenGoogleIds = new Set<string>();
      for (const gEvent of gEvents) {
        seenGoogleIds.add(gEvent.id);
        const appEvent = gCalEventToAppEvent(gEvent, user.uid);
        const existingDocId = existingMap.get(gEvent.id);
        if (existingDocId) {
          // Update existing
          batch.set(doc(db, "families", familyId, "events", existingDocId), appEvent);
        } else {
          // Insert new (skip if already in Firestore as an app event with this googleEventId)
          const ref = doc(collection(db, "families", familyId, "events"));
          batch.set(ref, appEvent);
        }
      }

      // Delete Firestore events that no longer exist in Google
      existingSnap.docs.forEach((d) => {
        const data = d.data() as CalendarEvent;
        if (data.googleEventId && !seenGoogleIds.has(data.googleEventId)) {
          batch.delete(d.ref);
        }
      });

      await batch.commit();
      setLastSynced(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sync failed";
      if (msg === "UNAUTHORIZED") {
        setSyncError("Google Calendar session expired. Please reconnect.");
      } else {
        setSyncError(msg);
      }
    } finally {
      setSyncing(false);
    }
  }, [googleCalendarToken, familyId, user]);

  // Auto-sync on load if connected
  useEffect(() => {
    if (googleCalendarConnected && googleCalendarToken) {
      syncGoogleCalendar(true);
    }
  }, [googleCalendarConnected, googleCalendarToken, syncGoogleCalendar]);

  // ── Calendar grid helpers ─────────────────────────────────────────────────
  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startPadding = startOfMonth(currentMonth).getDay();
  const eventsOnDay = (day: Date) => events.filter((e) => doesEventOccurOn(e, day));
  const selectedEvents = selectedDate ? eventsOnDay(selectedDate) : [];

  // ── Create event ──────────────────────────────────────────────────────────
  const handleAddEvent = async () => {
    if (!form.title.trim() || !selectedDate || !familyId || !user) return;

    const eventData: Omit<CalendarEvent, "id"> = {
      title: form.title.trim(),
      date: selectedDate.toISOString(),
      time: form.allDay ? "" : form.time,
      endTime: form.allDay ? "" : form.endTime,
      allDay: form.allDay,
      description: form.description.trim(),
      color: form.color,
      createdBy: user.uid,
      source: "app",
      recurring: form.recurring ?? "none",
    };

    // Push to Google Calendar if connected
    if (googleCalendarToken) {
      try {
        const googleEventId = await createGoogleEvent(googleCalendarToken, {
          title: eventData.title,
          date: selectedDate.toISOString(),
          time: eventData.time || undefined,
          endTime: eventData.endTime || undefined,
          allDay: eventData.allDay,
          description: eventData.description,
          recurring: eventData.recurring,
        });
        eventData.googleEventId = googleEventId;
      } catch {
        // Don't block saving locally if Google push fails
      }
    }

    await addDoc(collection(db, "families", familyId, "events"), eventData);
    setForm({ title: "", time: "", endTime: "", allDay: true, description: "", color: COLORS[0], recurring: "none" });
    setShowForm(false);
  };

  // ── Delete event ──────────────────────────────────────────────────────────
  const handleDelete = async (event: CalendarEvent) => {
    if (!familyId) return;

    // Also delete from Google Calendar if it has a googleEventId
    if (event.googleEventId && googleCalendarToken) {
      try {
        await deleteGoogleEvent(googleCalendarToken, event.googleEventId);
      } catch {
        // Continue with local delete even if Google fails
      }
    }

    await deleteDoc(doc(db, "families", familyId, "events", event.id));
  };

  // ── Connect Google Calendar ───────────────────────────────────────────────
  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectGoogleCalendar();
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      {/* Google Calendar connection banner */}
      {!googleCalendarConnected ? (
        <div className="rounded-2xl border p-4 flex items-center gap-3"
          style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <CalendarCheck className="w-8 h-8 flex-shrink-0" style={{ color: "#4285F4" }} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>Connect Google Calendar</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              Sync your Google Calendar events here
            </p>
          </div>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-white flex-shrink-0 disabled:opacity-50"
            style={{ background: "#4285F4" }}>
            {connecting ? "Connecting…" : "Connect"}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border p-3 flex items-center gap-3"
          style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
          <CalendarCheck className="w-5 h-5 flex-shrink-0" style={{ color: "#4285F4" }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>
              Google Calendar connected
            </p>
            {lastSynced && (
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Synced {format(lastSynced, "h:mm a")}
              </p>
            )}
            {syncError && (
              <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "#ef4444" }}>
                <AlertCircle className="w-3 h-3" /> {syncError}
              </p>
            )}
          </div>
          <button
            onClick={() => syncGoogleCalendar()}
            disabled={syncing}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-50"
            style={{ background: "var(--muted)" }}>
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`}
              style={{ color: "var(--muted-foreground)" }} />
          </button>
          <button
            onClick={disconnectGoogleCalendar}
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--muted)" }}
            title="Disconnect Google Calendar">
            <Unlink className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "var(--muted)" }}>
          <ChevronLeft className="w-5 h-5" style={{ color: "var(--foreground)" }} />
        </button>
        <h2 className="font-semibold text-lg" style={{ color: "var(--foreground)" }}>
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: "var(--muted)" }}>
          <ChevronRight className="w-5 h-5" style={{ color: "var(--foreground)" }} />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-2xl border overflow-hidden"
        style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
        <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--card-border)" }}>
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="text-center py-2 text-xs font-medium"
              style={{ color: "var(--muted-foreground)" }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`pad-${i}`} className="h-12" />
          ))}
          {days.map((day) => {
            const dayEvents = eventsOnDay(day);
            const selected = selectedDate && isSameDay(day, selectedDate);
            const today = isToday(day);
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className="h-12 flex flex-col items-center justify-start pt-1 gap-0.5">
                <span className="w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium"
                  style={{
                    background: selected ? "var(--primary)" : "transparent",
                    color: selected ? "white" : today ? "var(--primary)" : isSameMonth(day, currentMonth) ? "var(--foreground)" : "var(--muted-foreground)",
                    fontWeight: today && !selected ? 700 : undefined,
                  }}>
                  {format(day, "d")}
                </span>
                <div className="flex gap-0.5">
                  {dayEvents.slice(0, 3).map((e) => (
                    <div key={e.id} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: e.color || "var(--primary)" }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day */}
      {selectedDate && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold" style={{ color: "var(--foreground)" }}>
              {format(selectedDate, "EEEE, MMMM d")}
            </h3>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-white"
              style={{ background: "var(--primary)" }}>
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          {selectedEvents.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: "var(--muted-foreground)" }}>
              No events — tap Add to create one
            </p>
          )}

          {selectedEvents.map((event) => (
            <div key={event.id} className="rounded-xl border p-3 flex items-start gap-3"
              style={{ background: "var(--card)", borderColor: "var(--card-border)" }}>
              <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                style={{ background: event.color || "var(--primary)" }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm" style={{ color: "var(--foreground)" }}>
                    {event.title}
                  </p>
                  {event.source === "google" && (
                    <span className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                      style={{ background: "#4285F420", color: "#4285F4" }}>
                      Google
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  {!event.allDay && event.time && (
                    <p className="text-xs flex items-center gap-1"
                      style={{ color: "var(--muted-foreground)" }}>
                      <Clock className="w-3 h-3" />
                      {event.time}{event.endTime ? ` – ${event.endTime}` : ""}
                    </p>
                  )}
                  {event.recurring && event.recurring !== "none" && (
                    <p className="text-xs flex items-center gap-1"
                      style={{ color: "var(--muted-foreground)" }}>
                      <Repeat className="w-3 h-3" />
                      {RECURRENCE_LABELS[event.recurring]}
                    </p>
                  )}
                </div>
                {event.description && (
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                    {event.description}
                  </p>
                )}
              </div>
              <button onClick={() => handleDelete(event)}
                className="p-1.5 rounded-lg"
                style={{ background: "var(--muted)" }}>
                <Trash2 className="w-3.5 h-3.5" style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add event modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowForm(false)}>
          <div className="w-full max-w-lg rounded-t-3xl p-6 pb-8 space-y-4"
            style={{ background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg" style={{ color: "var(--foreground)" }}>
                  New Event
                </h3>
                {googleCalendarConnected && (
                  <p className="text-xs mt-0.5" style={{ color: "#4285F4" }}>
                    Will also be added to Google Calendar
                  </p>
                )}
              </div>
              <button onClick={() => setShowForm(false)}>
                <X className="w-5 h-5" style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>
            <input
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              placeholder="Event title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--foreground)" }}>
              <input type="checkbox" checked={form.allDay}
                onChange={(e) => setForm({ ...form, allDay: e.target.checked })} />
              All day
            </label>
            {!form.allDay && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Start</p>
                  <input type="time"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                    style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </div>
                <div className="flex-1">
                  <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>End</p>
                  <input type="time"
                    className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none"
                    style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                </div>
              </div>
            )}
            <textarea
              className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none resize-none"
              style={{ background: "var(--muted)", borderColor: "var(--card-border)", color: "var(--foreground)" }}
              placeholder="Description (optional)"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            {/* Recurrence */}
            <div>
              <p className="text-xs mb-1.5 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                <Repeat className="w-3.5 h-3.5" /> Repeats
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {RECURRENCE_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setForm({ ...form, recurring: value as CalendarEvent["recurring"] })}
                    className="py-2 px-2 rounded-xl text-xs font-medium transition-all"
                    style={{
                      background: form.recurring === value ? "var(--primary)" : "var(--muted)",
                      color: form.recurring === value ? "white" : "var(--muted-foreground)",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, color: c })}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{ background: c, outline: form.color === c ? `3px solid ${c}` : "none", outlineOffset: "2px" }} />
              ))}
            </div>
            <button
              onClick={handleAddEvent}
              disabled={!form.title.trim()}
              className="w-full py-3 rounded-xl font-medium text-white disabled:opacity-50"
              style={{ background: "var(--primary)" }}>
              Add Event
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
