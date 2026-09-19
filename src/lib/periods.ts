import { BUDGET } from "./format.ts";
import { generateId, type LedgerData, type LedgerPeriod } from "../storage/ledger-storage.ts";

export type { LedgerData, LedgerPeriod };

/** "YYYY-MM-DD" for a local calendar date. */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parses "YYYY-MM-DD" as a local date (new Date("YYYY-MM-DD") parses as UTC). */
export function fromISODate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Whole calendar days from `fromISO` (inclusive) to `date` (inclusive). */
function calendarDaysFrom(fromISO: string, date: Date): number | null {
  const start = fromISODate(fromISO);
  if (!start) return null;
  const dayMs = 86_400_000;
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const todayDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  // Rounding keeps this exact across DST shifts; both operands are local midnights.
  return Math.round((todayDay - startDay) / dayMs);
}

/**
 * 1-based day number of an ongoing period: the start date itself is day 1.
 * Calendar-date based, so DST transitions and month/year/leap boundaries
 * cannot skew the count.
 */
export function getDayNumber(period: LedgerPeriod, date: Date = new Date()): number {
  const days = calendarDaysFrom(period.startDate, date);
  return days === null || days < 0 ? 1 : days + 1;
}

export function createPeriod(startDate: string, budget: number): LedgerPeriod {
  return {
    id: generateId(),
    startDate,
    endDate: null,
    budget,
    status: "active",
    purchases: [],
  };
}

export function getActivePeriod(data: LedgerData): LedgerPeriod | undefined {
  return data.periods.find((p) => p.status === "active");
}

/**
 * Returns the data with an active period, creating one (today, with the
 * "budget for new period" setting) when none exists. There is never more
 * than one active period. Pure — does not touch storage.
 */
export function ensureActivePeriod(data: LedgerData, date: Date = new Date()): {
  data: LedgerData;
  created: boolean;
} {
  if (getActivePeriod(data)) return { data, created: false };

  const budget = data.nextBudget >= 1 ? data.nextBudget : BUDGET;
  const period = createPeriod(toISODate(date), budget);
  return {
    data: { ...data, periods: [period, ...data.periods] },
    created: true,
  };
}

export interface CompletionResult {
  data: LedgerData;
  /** false when there was no active period (the operation is idempotent). */
  completed: boolean;
  previous?: LedgerPeriod;
}

/**
 * Completes the active period as of `date`: it becomes an immutable
 * completed snapshot (endDate = date), and a new active period starts the
 * same day with the current "budget for new period" setting. Calling it
 * again without an active period changes nothing.
 */
export function completeActivePeriod(data: LedgerData, date: Date = new Date()): CompletionResult {
  const active = getActivePeriod(data);
  if (!active) return { data, completed: false };

  const endDate = toISODate(date);
  const previous: LedgerPeriod = {
    ...active,
    status: "completed",
    endDate: endDate < active.startDate ? active.startDate : endDate,
  };
  const rest = data.periods.filter((p) => p.id !== active.id);

  const budget = data.nextBudget >= 1 ? data.nextBudget : BUDGET;
  const next = createPeriod(endDate, budget);

  return {
    data: { ...data, periods: [next, previous, ...rest] },
    completed: true,
    previous,
  };
}

export function getPeriodById(data: LedgerData, id: string): LedgerPeriod | undefined {
  return data.periods.find((p) => p.id === id);
}

export function sumPurchases(period: LedgerPeriod): number {
  return period.purchases.reduce((acc, p) => acc + p.amount, 0);
}

export function getBalance(period: LedgerPeriod): number {
  return period.budget - sumPurchases(period);
}
