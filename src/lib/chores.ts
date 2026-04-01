import { addDays, addWeeks, addMonths, parseISO, isBefore, startOfDay } from "date-fns";
import { ChoreFrequency } from "@/types";

export function getNextResetDate(lastReset: string, frequency: ChoreFrequency): string {
  const base = parseISO(lastReset);
  let next: Date;
  switch (frequency) {
    case "weekly":
      next = addWeeks(base, 1);
      break;
    case "biweekly":
      next = addWeeks(base, 2);
      break;
    case "monthly":
      next = addMonths(base, 1);
      break;
  }
  return next.toISOString();
}

export function shouldReset(nextResetDate: string): boolean {
  return isBefore(parseISO(nextResetDate), startOfDay(new Date()));
}

export function getNewResetDates(frequency: ChoreFrequency): { lastResetDate: string; nextResetDate: string } {
  const today = startOfDay(new Date()).toISOString();
  return {
    lastResetDate: today,
    nextResetDate: getNextResetDate(today, frequency),
  };
}
