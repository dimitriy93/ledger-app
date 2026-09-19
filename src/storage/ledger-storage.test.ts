/**
 * Unit tests for storage v2: sanitization and the v1 -> v2 migration.
 * Run with: npm test  (or: node src/storage/ledger-storage.test.ts)
 */
import { BUDGET } from "../lib/format.ts";
import {
  parseImport,
  sanitizeLedgerData,
  SCHEMA_VERSION,
  serializeForExport,
  StorageError,
  type LedgerData,
} from "./ledger-storage.ts";

let failures = 0;
function check(name: string, condition: boolean): void {
  if (condition) {
    console.log(`ok   ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}`);
  }
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayShift(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

const NOW = new Date();
const TODAY = toISODate(NOW);

// --- Migration v1 -> v2 ----------------------------------------------------

// A v1 document the way the old calendar logic would have stored it: the
// current 5–19 window plus one finished window in history.
const v1 = {
  version: 1,
  periods: [
    {
      id: TODAY,
      startDate: TODAY,
      endDate: toISODate(dayShift(NOW, 14)),
      budget: 15000,
      purchases: [{ id: "x", title: "Молоко", amount: 120, createdAt: "2026-09-19T08:00:00.000Z" }],
    },
    {
      id: "2026-08-20",
      startDate: "2026-08-20",
      endDate: "2026-09-04",
      budget: 15000,
      purchases: [{ id: "y", title: "Курица", amount: 450, createdAt: "2026-08-22T08:00:00.000Z" }],
    },
  ],
};

const migrated = parseImport(JSON.stringify(v1));
check("migration bumps the version to 2", migrated.version === SCHEMA_VERSION);
check("migration adds the default budget setting", migrated.nextBudget === BUDGET);

const migratedCurrent = migrated.periods.find((p) => p.startDate === TODAY)!;
check(
  "the v1 period covering today stays active with open endDate",
  migratedCurrent.status === "active" && migratedCurrent.endDate === null
);
check("the current period keeps its purchases", migratedCurrent.purchases.length === 1);
check("the current period keeps its budget", migratedCurrent.budget === 15000);

const migratedPast = migrated.periods.find((p) => p.startDate === "2026-08-20")!;
check(
  "finished v1 periods become completed history",
  migratedPast.status === "completed" && migratedPast.endDate === "2026-09-04"
);
check("history purchases survive the migration", migratedPast.purchases.length === 1);

check(
  "migrated newest period sorts first",
  migrated.periods[0].startDate === TODAY
);

// A v1 user returning after a long absence: no period covers today, so
// everything becomes history and the app creates a fresh period on load.
const stale = parseImport(
  JSON.stringify({
    version: 1,
    periods: [
      {
        id: "2026-01-05",
        startDate: "2026-01-05",
        endDate: "2026-01-19",
        budget: 15000,
        purchases: [{ id: "z", title: "Овощи", amount: 800, createdAt: "2026-01-06T08:00:00.000Z" }],
      },
    ],
  })
);
check(
  "stale v1 history does not resurrect as active",
  stale.periods.length === 1 &&
    stale.periods[0].status === "completed" &&
    stale.periods[0].purchases.length === 1
);

// --- Sanitization ----------------------------------------------------------

const twoActives = sanitizeLedgerData({
  version: 2,
  nextBudget: 15000,
  periods: [
    { id: "a", startDate: "2026-09-01", endDate: null, budget: 100, status: "active", purchases: [] },
    { id: "b", startDate: "2026-09-10", endDate: null, budget: 200, status: "active", purchases: [] },
  ],
});
check(
  "only the newest active period survives as active",
  twoActives.periods.find((p) => p.id === "b")!.status === "active"
);
check(
  "the older active is demoted to a completed snapshot, not deleted",
  twoActives.periods.find((p) => p.id === "a")!.status === "completed" &&
    twoActives.periods.find((p) => p.id === "a")!.endDate !== null
);

const invalid = sanitizeLedgerData({
  version: 2,
  nextBudget: -5,
  periods: [
    {
      id: "c",
      startDate: "2026-09-10",
      endDate: "2026-09-01", // ends before it starts
      budget: 0,
      status: "completed",
      purchases: [{ title: "Чай", amount: 75 }],
    },
    { notAPeriod: true },
  ],
});
check("invalid budget setting falls back to the default", invalid.nextBudget === BUDGET);
check("invalid period budget is coerced positive", invalid.periods[0].budget === 1);
check("endDate is never before startDate", invalid.periods[0].endDate === "2026-09-10");
check("purchase without an id still survives", invalid.periods[0].purchases.length === 1);

const garbage = sanitizeLedgerData("not an object");
check("garbage input yields empty data with defaults", garbage.periods.length === 0 && garbage.nextBudget === BUDGET);

// --- Round trip / guards ---------------------------------------------------

const roundTrip: LedgerData = parseImport(
  serializeForExport({
    version: SCHEMA_VERSION,
    nextBudget: 20000,
    periods: [
      { id: "p", startDate: "2026-09-18", endDate: null, budget: 20000, status: "active", purchases: [] },
    ],
  })
);
check("export -> import round trip preserves the data", roundTrip.nextBudget === 20000 && roundTrip.periods.length === 1);

let threw = false;
try {
  parseImport("{ nope");
} catch (error) {
  threw = error instanceof StorageError;
}
check("corrupted JSON throws StorageError", threw);

let futureRejected = false;
try {
  parseImport(JSON.stringify({ version: SCHEMA_VERSION + 1, periods: [] }));
} catch (error) {
  futureRejected = error instanceof StorageError;
}
check("a file from a newer version is rejected", futureRejected);

if (failures > 0) {
  process.exit(1);
}
console.log("\nAll storage tests passed.");
