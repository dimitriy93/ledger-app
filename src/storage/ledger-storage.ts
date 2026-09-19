/**
 * Single storage layer for Ledger. All persistence goes through this module —
 * React components never touch localStorage directly, so the backend can later
 * be swapped for IndexedDB or something remote without UI changes.
 *
 * Money is stored as integer rubles. The persisted schema is versioned so
 * future structural changes can run through `MIGRATIONS`.
 */

export const SCHEMA_VERSION = 1;
const STORAGE_KEY = "ledger.data.v1";

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
  endDate: string; // YYYY-MM-DD inclusive
  budget: number;
  purchases: Purchase[];
}

export interface LedgerData {
  version: number;
  periods: LedgerPeriod[];
}

export type MigrationResult =
  | { ok: true; data: LedgerData }
  | { ok: false; reason: string };

type Migration = (input: unknown) => unknown;

const MIGRATIONS: Record<number, Migration> = {
  // Example for a future version 2:
  // 2: (data) => ({ ...data as object, newField: defaultValue }),
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

function toDateString(value: unknown, fallback: string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return fallback;
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
  const endDate = toDateString(input.endDate, startDate);

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
    purchases,
  };
}

/** Deep sanitization: never trusts stored/imported JSON. */
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
  return { version: SCHEMA_VERSION, periods };
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
  if (typeof window === "undefined") return { version: SCHEMA_VERSION, periods: [] };

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private mode, disabled cookies) — start empty.
    return { version: SCHEMA_VERSION, periods: [] };
  }
  if (!raw) return { version: SCHEMA_VERSION, periods: [] };

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
      return { version: SCHEMA_VERSION, periods: [] };
    }
    return result.data;
  } catch {
    return { version: SCHEMA_VERSION, periods: [] };
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
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `ledger-backup-${y}-${m}-${d}.json`;
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
