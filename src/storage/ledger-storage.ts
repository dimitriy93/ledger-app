/**
 * Single storage layer for Ledger. All persistence goes through this module —
 * React components never touch localStorage directly, so the backend can later
 * be swapped for IndexedDB or something remote without UI changes.
 *
 * Money is stored as integer rubles. The persisted schema is versioned so
 * future structural changes can run through `MIGRATIONS`.
 */

// The explicit .ts extension lets the pure domain/storage modules also run
// under plain `node` for the unit tests (tsconfig has allowImportingTsExtensions).
import { BUDGET } from "../lib/format.ts";

export const SCHEMA_VERSION = 2;
const STORAGE_KEY = "ledger.data.v1";

export type PeriodStatus = "active" | "completed";

export interface Purchase {
  id: string;
  title: string;
  amount: number;
  /** ISO datetime, set automatically at creation; never changed on edit. */
  createdAt: string;
}

export interface LedgerPeriod {
  id: string;
  startDate: string; // YYYY-MM-DD inclusive
  /** Completion date, or null while the period is active. */
  endDate: string | null;
  budget: number;
  status: PeriodStatus;
  purchases: Purchase[];
}

export interface LedgerData {
  version: number;
  /** Budget applied to every newly created period; never touches existing ones. */
  nextBudget: number;
  periods: LedgerPeriod[];
}

export type MigrationResult =
  | { ok: true; data: LedgerData }
  | { ok: false; reason: string };

type Migration = (input: unknown) => unknown;

/**
 * v1 -> v2: budget periods were calendar-based (5th–19th, 20th–4th) with fixed
 * endDate bounds. Now periods are manual: an active period has no endDate, a
 * completed one is an immutable snapshot. The v1 period covering today carries
 * the user's ongoing expenses, so it continues as the active period; all other
 * periods become completed history. Nothing is deleted or re-created.
 */
function migrateV1ToV2(input: unknown): unknown {
  if (!isRecord(input)) return input;
  const todayISO = toISODate(new Date());
  const rawPeriods = Array.isArray(input.periods) ? input.periods : [];

  const periods = rawPeriods.map((raw) => {
    if (!isRecord(raw)) return raw;
    const start = typeof raw.startDate === "string" ? raw.startDate : "";
    const end = typeof raw.endDate === "string" ? raw.endDate : "";
    // ISO dates compare correctly as plain strings.
    const isCurrent = start !== "" && start <= todayISO && (end === "" || todayISO <= end);
    return {
      ...raw,
      status: isCurrent ? "active" : "completed",
      endDate: isCurrent ? null : end || start,
    };
  });

  return { ...input, version: 2, nextBudget: BUDGET, periods };
}

const MIGRATIONS: Record<number, Migration> = {
  1: migrateV1ToV2,
};

export class StorageError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Coerces unknown input to a finite integer (0 on failure). */
function toSafeInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function toPositiveInt(value: unknown): number {
  return Math.max(1, toSafeInt(value));
}

/** Positive integer budget with a fallback for missing/invalid values. */
function toBudget(value: unknown, fallback: number): number {
  const n = toSafeInt(value);
  return n >= 1 ? n : fallback;
}

function toDateString(value: unknown, fallback: string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return fallback;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sanitizePurchase(input: unknown): Purchase | null {
  if (!isRecord(input)) return null;
  const title = typeof input.title === "string" ? input.title.trim().slice(0, 200) : "";
  if (!title) return null;

  const amount = toPositiveInt(input.amount);
  let createdAt =
    typeof input.createdAt === "string" && !Number.isNaN(new Date(input.createdAt).getTime())
      ? new Date(input.createdAt).toISOString()
      : "";
  if (!createdAt) createdAt = new Date(0).toISOString();

  const id = typeof input.id === "string" && input.id ? input.id : generateId();
  return { id, title, amount, createdAt };
}

function sanitizePeriod(input: unknown, seenIds: Set<string>): LedgerPeriod | null {
  if (!isRecord(input)) return null;
  const startDate = toDateString(input.startDate, "");
  if (!startDate) return null;

  const status: PeriodStatus = input.status === "completed" ? "completed" : "active";
  // An active period is open-ended; a completed one always knows when it ended.
  let endDate =
    status === "active" ? null : input.endDate === null ? null : toDateString(input.endDate, "");
  if (status === "completed" && !endDate) endDate = startDate;
  if (status === "completed" && endDate && endDate < startDate) endDate = startDate;

  const purchases: Purchase[] = [];
  const seenPurchaseIds = new Set<string>();
  if (Array.isArray(input.purchases)) {
    for (const raw of input.purchases) {
      const purchase = sanitizePurchase(raw);
      if (!purchase || seenPurchaseIds.has(purchase.id)) continue;
      seenPurchaseIds.add(purchase.id);
      purchases.push(purchase);
    }
  }
  purchases.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  let id = typeof input.id === "string" && input.id ? input.id : startDate;
  if (seenIds.has(id)) id = `${id}#${seenIds.size}`;
  seenIds.add(id);

  return {
    id,
    startDate,
    endDate,
    budget: toPositiveInt(input.budget),
    status,
    purchases,
  };
}

/**
 * Deep sanitization: never trusts stored/imported JSON. Guarantees the
 * domain invariant that at most one period is active (the newest one;
 * any others are demoted to completed history, never dropped).
 */
export function sanitizeLedgerData(input: unknown): LedgerData {
  const periods: LedgerPeriod[] = [];
  const seenIds = new Set<string>();

  if (isRecord(input) && Array.isArray(input.periods)) {
    for (const raw of input.periods) {
      const period = sanitizePeriod(raw, seenIds);
      if (period) periods.push(period);
    }
  }

  // Newest period first (by start date, descending).
  periods.sort((a, b) => b.startDate.localeCompare(a.startDate));

  const newestActiveIndex = periods.findIndex((p) => p.status === "active");
  if (newestActiveIndex !== -1) {
    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      if (i !== newestActiveIndex && period.status === "active") {
        periods[i] = {
          ...period,
          status: "completed",
          endDate: period.endDate ?? period.startDate,
        };
      }
    }
  }

  return {
    version: SCHEMA_VERSION,
    nextBudget: isRecord(input) ? toBudget(input.nextBudget, BUDGET) : BUDGET,
    periods,
  };
}

function migrate(input: unknown): MigrationResult {
  if (!isRecord(input)) {
    return { ok: false, reason: "Данные повреждены или имеют неверный формат." };
  }
  if (Array.isArray(input)) {
    // Defensive: an array is not a valid document shape.
    return { ok: false, reason: "Данные повреждены или имеют неверный формат." };
  }

  let version = toSafeInt(input.version);
  if (!("version" in input) || version < 1) version = 1;
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      reason:
        "Файл создан более новой версией Ledger. Обновите приложение перед импортом.",
    };
  }

  let current: unknown = input;
  while (version < SCHEMA_VERSION) {
    const migration = MIGRATIONS[version];
    if (!migration) break;
    current = migration(current);
    version += 1;
  }

  return { ok: true, data: sanitizeLedgerData(current) };
}

export function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function loadLedger(): LedgerData {
  if (typeof window === "undefined") {
    return { version: SCHEMA_VERSION, nextBudget: BUDGET, periods: [] };
  }

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, disabled cookies) — start empty.
    return { version: SCHEMA_VERSION, nextBudget: BUDGET, periods: [] };
  }
  if (!raw) return { version: SCHEMA_VERSION, nextBudget: BUDGET, periods: [] };

  try {
    const parsed: unknown = JSON.parse(raw);
    const result = migrate(parsed);
    if (!result.ok) {
      // Corrupted data: keep it under a quarantine key instead of silently
      // overwriting, then start fresh.
      try {
        window.localStorage.setItem(`${STORAGE_KEY}.corrupted`, raw);
      } catch {
        /* ignore */
      }
      return { version: SCHEMA_VERSION, nextBudget: BUDGET, periods: [] };
    }
    return result.data;
  } catch {
    return { version: SCHEMA_VERSION, nextBudget: BUDGET, periods: [] };
  }
}

export function saveLedger(data: LedgerData): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    throw new StorageError(
      "Не удалось сохранить данные. Возможно, переполнено хранилище браузера.",
      { cause: error }
    );
  }
}

export function clearLedger(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function serializeForExport(data: LedgerData): string {
  return JSON.stringify({ ...data, version: SCHEMA_VERSION }, null, 2);
}

export function backupFileName(now: Date = new Date()): string {
  return `ledger-backup-${toISODate(now)}.json`;
}

/** Parses and validates an imported JSON string. Throws StorageError on failure. */
export function parseImport(json: string): LedgerData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new StorageError("Файл не является корректным JSON.");
  }
  const result = migrate(parsed);
  if (!result.ok) throw new StorageError(result.reason);
  return result.data;
}
