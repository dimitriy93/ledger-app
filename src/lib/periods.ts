import { BUDGET } from "./format";
import type { LedgerPeriod } from "../storage/ledger-storage";

export type { LedgerPeriod };

/**
 * Budget periods run from the 5th to the 19th (inclusive) and from the 20th
 * to the 4th of the next month (inclusive). No assumptions about month
 * lengths are made — Date arithmetic handles month/year/leap boundaries.
 */
export function getPeriodBoundsFor(date: Date): { start: Date; end: Date } {
  const day = date.getDate();
  const y = date.getFullYear();
  const m = date.getMonth();

  if (day >= 5 && day <= 19) {
    return {
      start: new Date(y, m, 5),
      end: new Date(y, m, 19),
    };
  }
  if (day >= 20) {
    return {
      start: new Date(y, m, 20),
      end: new Date(y, m + 1, 4),
    };
  }
  // day 1..4 -> period started on the 20th of the previous month
  return {
    start: new Date(y, m - 1, 20),
    end: new Date(y, m, 4),
  };
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function periodIdFor(date: Date): string {
  return toISODate(getPeriodBoundsFor(date).start);
}

export function createPeriodFor(date: Date): LedgerPeriod {
  const { start, end } = getPeriodBoundsFor(date);
  return {
    id: toISODate(start),
    startDate: toISODate(start),
    endDate: toISODate(end),
    budget: BUDGET,
    purchases: [],
  };
}

/** True when `date` falls within [startDate, endDate] of the period. */
export function periodContainsDate(period: LedgerPeriod, date: Date): boolean {
  const start = new Date(period.startDate);
  const end = new Date(period.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const rangeStart = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const rangeEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return dayStart >= rangeStart && dayStart <= rangeEnd;
}

/**
 * Returns the data with a period covering `date`, creating it (as a fresh
 * 15 000 ₽ budget) when missing. Pure — does not touch storage.
 */
export function ensureCurrentPeriod<T extends { periods: LedgerPeriod[] }>(
  data: T,
  date: Date = new Date()
): { data: T; created: boolean } {
  const existing = data.periods.find((p) => periodContainsDate(p, date));
  if (existing) return { data, created: false };

  const period = createPeriodFor(date);
  return {
    data: { ...data, periods: [period, ...data.periods] },
    created: true,
  };
}

export function getPeriodById(data: { periods: LedgerPeriod[] }, id: string): LedgerPeriod | undefined {
  return data.periods.find((p) => p.id === id);
}

export function sumPurchases(period: LedgerPeriod): number {
  return period.purchases.reduce((acc, p) => acc + p.amount, 0);
}

export function getBalance(period: LedgerPeriod): number {
  return period.budget - sumPurchases(period);
}
