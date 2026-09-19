/**
 * Unit sanity checks for the budget period calendar.
 * Run with: node src/lib/periods.test.ts
 */
import { getPeriodBoundsFor, periodContainsDate, ensureCurrentPeriod } from "./periods";

function iso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const cases: Array<[string, string]> = [
  ["2026-09-05", "2026-09-05..2026-09-19"],
  ["2026-09-19", "2026-09-05..2026-09-19"],
  ["2026-09-20", "2026-09-20..2026-10-04"],
  ["2026-10-04", "2026-09-20..2026-10-04"],
  ["2026-10-05", "2026-10-05..2026-10-19"],
  ["2026-12-20", "2026-12-20..2027-01-04"],
  ["2026-12-31", "2026-12-20..2027-01-04"],
  ["2027-01-01", "2026-12-20..2027-01-04"],
  ["2027-01-04", "2026-12-20..2027-01-04"],
  ["2027-01-05", "2027-01-05..2027-01-19"],
  ["2028-02-29", "2028-02-20..2028-03-04"], // leap February
  ["2028-03-01", "2028-02-20..2028-03-04"],
  ["2027-02-28", "2027-02-20..2027-03-04"], // non-leap February
];

let failures = 0;
for (const [dateStr, expected] of cases) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const bounds = getPeriodBoundsFor(new Date(y, m - 1, d));
  const actual = `${iso(bounds.start)}..${iso(bounds.end)}`;
  if (actual !== expected) {
    failures++;
    console.error(`FAIL ${dateStr}: got ${actual}, expected ${expected}`);
  } else {
    console.log(`ok   ${dateStr} -> ${actual}`);
  }
}

// periodContainsDate: inclusive bounds
const period = {
  id: "2026-09-05",
  startDate: "2026-09-05",
  endDate: "2026-09-19",
  budget: 15000,
  purchases: [],
};
const contains: Array<[string, boolean]> = [
  ["2026-09-05", true],
  ["2026-09-19", true],
  ["2026-09-20", false],
  ["2026-09-04", false],
];
for (const [dateStr, expected] of contains) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const actual = periodContainsDate(period, new Date(y, m - 1, d));
  if (actual !== expected) {
    failures++;
    console.error(`FAIL contains ${dateStr}: got ${actual}, expected ${expected}`);
  } else {
    console.log(`ok   contains ${dateStr} -> ${actual}`);
  }
}

// ensureCurrentPeriod creates only when missing
const empty: { periods: typeof period[] } = { periods: [] };
const created = ensureCurrentPeriod(empty, new Date(2026, 8, 6));
if (created.created !== true || created.data.periods.length !== 1) {
  failures++;
  console.error("FAIL ensureCurrentPeriod did not create a period");
} else {
  console.log(`ok   ensureCurrentPeriod -> ${created.data.periods[0].id}`);
}
const existing = ensureCurrentPeriod(created.data, new Date(2026, 8, 10));
if (existing.created !== false || existing.data.periods.length !== 1) {
  failures++;
  console.error("FAIL ensureCurrentPeriod created a duplicate");
} else {
  console.log("ok   ensureCurrentPeriod idempotent");
}

if (failures > 0) {
  process.exit(1);
}
console.log("\nAll period tests passed.");
