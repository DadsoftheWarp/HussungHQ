"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CalendarEvent } from "@/types";
import Link from "next/link";
import {
  Calendar,
  DollarSign,
  CheckSquare,
  Target,
  ListChecks,
  Utensils,
  Clock,
  ChevronRight,
} from "lucide-react";
import {
  format,
  isToday,
  isTomorrow,
  parseISO,
  startOfDay,
  isBefore,
  addDays,
  eachDayOfInterval,
} from "date-fns";
import { doesEventOccurOn } from "@/lib/calendarUtils";

const MODULES = [
  {
    href: "/dashboard/calendar",
    icon: Calendar,
    label: "Calendar",
    color: "#6366f1",
    desc: "Upcoming events",
  },
  {
    href: "/dashboard/budget",
    icon: DollarSign,
    label: "Budget",
    color: "#10b981",
    desc: "Track spending",
  },
  {
    href: "/dashboard/todos",
    icon: CheckSquare,
    label: "To-Do Lists",
    color: "#f59e0b",
    desc: "Tasks & lists",
  },
  {
    href: "/dashboard/goals",
    icon: Target,
    label: "Goals",
    color: "#ec4899",
    desc: "House projects",
  },
  {
    href: "/dashboard/chores",
    icon: ListChecks,
    label: "Chores",
    color: "#8b5cf6",
    desc: "Weekly chores",
  },
  {
    href: "/dashboard/meals",
    icon: Utensils,
    label: "Meal Planner",
    color: "#14b8a6",
    desc: "Weekly meals",
  },
];

function eventDateLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return format(date, "EEE, MMM d");
}

export default function DashboardPage() {
  const { user, familyId } = useAuth();
  const firstName = user?.displayName?.split(" ")[0] ?? "there";
  const today = format(new Date(), "EEEE, MMMM d");
  const [upcomingEvents, setUpcomingEvents] = useState<
    (CalendarEvent & { occurrenceDate: string })[]
  >([]);

  useEffect(() => {
    if (!familyId) return;
    const q = query(
      collection(db, "families", familyId, "events"),
      orderBy("date"),
    );
    return onSnapshot(q, (snap) => {
      const now = startOfDay(new Date());
      const cutoff = addDays(now, 14);
      const allEvents = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as CalendarEvent,
      );
      const days = eachDayOfInterval({ start: now, end: cutoff });

      // Build a deduplicated list: one entry per (event, date) occurrence
      const upcoming: (CalendarEvent & { occurrenceDate: string })[] = [];
      for (const day of days) {
        for (const event of allEvents) {
          if (doesEventOccurOn(event, day)) {
            upcoming.push({ ...event, occurrenceDate: day.toISOString() });
          }
        }
        if (upcoming.length >= 5) break;
      }
      setUpcomingEvents(upcoming);
    });
  }, [familyId]);

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
      {/* Greeting */}
      <div>
        <h1
          className="text-2xl font-bold mt-1"
          style={{ color: "var(--foreground)" }}
        >
          Hello there, {firstName}!
        </h1>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {today}
        </p>
      </div>

      {/* Mini agenda */}
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: "var(--card)", borderColor: "var(--card-border)" }}
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "var(--card-border)" }}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: "var(--primary)" }} />
            <p
              className="font-semibold text-sm"
              style={{ color: "var(--foreground)" }}
            >
              Upcoming
            </p>
          </div>
          <Link
            href="/dashboard/calendar"
            className="flex items-center gap-0.5 text-xs"
            style={{ color: "var(--primary)" }}
          >
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {upcomingEvents.length === 0 ? (
          <div className="px-4 py-5 text-center">
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              No events in the next 14 days
            </p>
          </div>
        ) : (
          <div
            className="divide-y"
            style={{ borderColor: "var(--card-border)" }}
          >
            {upcomingEvents.map((event) => (
              <Link
                key={`${event.id}-${event.occurrenceDate}`}
                href="/dashboard/calendar"
                className="flex items-center gap-3 px-4 py-3 hover:opacity-80 transition-opacity"
              >
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: event.color || "var(--primary)" }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--foreground)" }}
                  >
                    {event.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {eventDateLabel(event.occurrenceDate)}
                    </p>
                    {!event.allDay && event.time && (
                      <p
                        className="text-xs flex items-center gap-0.5"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        <Clock className="w-3 h-3" /> {event.time}
                      </p>
                    )}
                  </div>
                </div>
                {event.source === "google" && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0"
                    style={{ background: "#4285F420", color: "#4285F4" }}
                  >
                    G
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-2 gap-3">
        {MODULES.map(({ href, icon: Icon, label, color, desc }) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl border p-4 flex flex-col gap-3 transition-all hover:opacity-90 active:scale-95"
            style={{
              background: "var(--card)",
              borderColor: "var(--card-border)",
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${color}20` }}
            >
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <p
                className="font-semibold text-sm"
                style={{ color: "var(--foreground)" }}
              >
                {label}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: "var(--muted-foreground)" }}
              >
                {desc}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
