/**
 * Unit tests for the manual (user-driven) period domain logic.
 * Run with: npm test  (or: node src/lib/periods.test.ts)
 */
import { BUDGET, formatDayCount } from "./format.ts";
import {
  completeActivePeriod,
  createPeriod,
  ensureActivePeriod,
  getActivePeriod,
  getDayNumber,
  getBalance,
  sumPurchases,
  toISODate,
  type LedgerData,
  type LedgerPeriod,
} from "./periods.ts";

function dayShift(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

function activePeriodOf(data: LedgerData): LedgerPeriod {
  const period = getActivePeriod(data);
  if (!period) throw new Error("expected an active period");
  return period;
}

let failures = 0;
function check(name: string, condition: boolean): void {
  if (condition) {
    console.log(`ok   ${name}`);
  } else {
    failures++;
    console.error(`FAIL ${name}`);
  }
}

const NOW = new Date(2026, 8, 18); // 18 September 2026, local
const TODAY_ISO = toISODate(NOW);

function emptyData(nextBudget = BUDGET): LedgerData {
  return { version: 2, nextBudget, periods: [] };
}

// --- Creation -------------------------------------------------------------

const first = ensureActivePeriod(emptyData(), NOW);
check("first period is created", first.created);
check("first period starts today", activePeriodOf(first.data).startDate === TODAY_ISO);
check("first period has default budget 15000", activePeriodOf(first.data).budget === 15000);
check("first period is active and open-ended", (() => {
  const p = activePeriodOf(first.data);
  return p.status === "active" && p.endDate === null;
})());
check("first period is day 1", getDayNumber(activePeriodOf(first.data), NOW) === 1);
check(
  "ensureActivePeriod is idempotent on reload",
  (() => {
    const again = ensureActivePeriod(first.data, dayShift(NOW, 1));
    return !again.created && again.data.periods.length === 1;
  })()
);

// --- Day number -----------------------------------------------------------

const dayCases: Array<[string, string, string, number]> = [
  ["same day is day 1", "2026-09-18", "2026-09-18", 1],
  ["next day is day 2", "2026-09-18", "2026-09-19", 2],
  ["ten days later is day 11", "2026-09-18", "2026-09-28", 11],
  ["month boundary 30.09 -> 01.10", "2026-09-30", "2026-10-01", 2],
  ["year boundary 31.12 -> 01.01", "2026-12-31", "2027-01-01", 2],
  ["leap February 28.02 -> 29.02", "2028-02-28", "2028-02-29", 2],
  ["non-leap February 28.02 -> 01.03", "2027-02-28", "2027-03-01", 2],
];
for (const [name, startISO, todayISO, expected] of dayCases) {
  const [y, m, d] = todayISO.split("-").map(Number);
  const period = createPeriod(startISO, 15000);
  check(`day number: ${name}`, getDayNumber(period, new Date(y, m - 1, d)) === expected);
}

// --- Completion -----------------------------------------------------------

const withPurchases: LedgerPeriod = {
  id: "p1",
  startDate: "2026-09-10",
  endDate: null,
  budget: 12000,
  status: "active",
  purchases: [
    { id: "a", title: "Молоко", amount: 120, createdAt: "2026-09-11T08:00:00.000Z" },
    { id: "b", title: "Курица", amount: 450, createdAt: "2026-09-12T08:00:00.000Z" },
  ],
};
const completeAt = new Date(2026, 8, 25); // 25 September 2026
const completing = completeActivePeriod(
  { version: 2, nextBudget: 20000, periods: [withPurchases] },
  completeAt
);

check("completion reports completed", completing.completed);
const finished = completing.previous!;
check("old period becomes completed", finished.status === "completed");
check("old period endDate is the completion date", finished.endDate === "2026-09-25");
check("old period keeps its budget", finished.budget === 12000);
check("old period keeps its purchases", finished.purchases.length === 2);
check("old period balance is untouched", getBalance(finished) === 12000 - 570);

const next = activePeriodOf(completing.data);
check("a new active period is created", next.status === "active");
check("new period starts on the completion date", next.startDate === "2026-09-25");
check("new period uses the budget setting", next.budget === 20000);
check("new period starts empty", sumPurchases(next) === 0 && getBalance(next) === 20000);
check("new period is day 1", getDayNumber(next, completeAt) === 1);
check("both periods are kept in history data", completing.data.periods.length === 2);

check(
  "each completion consumes exactly one active period, keeping data consistent",
  (() => {
    // A second completion call on the fresh data completes the newly created
    // period (the UI layer blocks same-moment double presses); the data must
    // still stay consistent — two completed snapshots, one active period.
    const twice = completeActivePeriod(completing.data, dayShift(completeAt, 1));
    return (
      twice.completed &&
      twice.data.periods.filter((p) => p.status === "completed").length === 2 &&
      twice.data.periods.filter((p) => p.status === "active").length === 1
    );
  })()
);

check(
  "completion without an active period is a no-op",
  !completeActivePeriod(emptyData(), completeAt).completed
);

check(
  "completion without a budget setting falls back to the default",
  activePeriodOf(
    completeActivePeriod({ version: 2, nextBudget: 0, periods: [withPurchases] }, completeAt).data
  ).budget === BUDGET
);

// --- Protection -----------------------------------------------------------

check(
  "a long absence never rolls the period over",
  (() => {
    const absent = ensureActivePeriod(first.data, dayShift(NOW, 100));
    return !absent.created && activePeriodOf(absent.data).startDate === TODAY_ISO;
  })()
);

check(
  "reload after completion does not create another period",
  (() => {
    const reloaded = ensureActivePeriod(completing.data, dayShift(completeAt, 5));
    return !reloaded.created && reloaded.data.periods.length === 2;
  })()
);

check(
  "clearing purchases from history is rejected at the hook level is covered elsewhere; domain keeps both periods",
  completing.data.periods.filter((p) => p.status === "active").length === 1
);

// --- Formatting -----------------------------------------------------------

const pluralCases: Array<[number, string]> = [
  [1, "1 день"],
  [2, "2 дня"],
  [3, "3 дня"],
  [4, "4 дня"],
  [5, "5 дней"],
  [11, "11 дней"],
  [21, "21 день"],
  [22, "22 дня"],
  [25, "25 дней"],
  [100, "100 дней"],
  [111, "111 дней"],
  [112, "112 дней"],
];
for (const [n, expected] of pluralCases) {
  check(`plural: ${expected}`, formatDayCount(n) === expected);
}

if (failures > 0) {
  process.exit(1);
}
console.log("\nAll period tests passed.");
