import { parseISO, isSameDay, isBefore, startOfDay, differenceInCalendarDays } from "date-fns";
import { CalendarEvent } from "@/types";

/**
 * Returns true if the event (including recurring instances) falls on the given date.
 */
export function doesEventOccurOn(event: CalendarEvent, date: Date): boolean {
  const start = parseISO(event.date);
  const day = startOfDay(date);
  const startDay = startOfDay(start);

  // Non-recurring — exact date match only
  if (!event.recurring || event.recurring === "none") {
    return isSameDay(startDay, day);
  }

  // Recurring events can't occur before their start date
  if (isBefore(day, startDay)) return false;

  const diff = differenceInCalendarDays(day, startDay);

  switch (event.recurring) {
    case "weekly":
      return diff % 7 === 0;
    case "biweekly":
      return diff % 14 === 0;
    case "monthly":
      return date.getDate() === start.getDate();
    case "yearly":
      return date.getDate() === start.getDate() && date.getMonth() === start.getMonth();
    default:
      return isSameDay(startDay, day);
  }
}

export const RECURRENCE_OPTIONS = [
  { value: "none",     label: "Does not repeat" },
  { value: "weekly",   label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "monthly",  label: "Monthly" },
  { value: "yearly",   label: "Yearly" },
] as const;

export const RECURRENCE_LABELS: Record<string, string> = {
  weekly:   "Weekly",
  biweekly: "Every 2 weeks",
  monthly:  "Monthly",
  yearly:   "Yearly",
};
