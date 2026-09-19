export const BUDGET = 15000;
export const APP_VERSION = "1.1.0";

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

/**
 * Formats an integer amount of rubles, e.g. 8540 -> "8 540 ₽".
 * Negative values use a typographic minus: -350 -> "−350 ₽".
 * Guarded so NaN/Infinity/null can never leak into the UI.
 */
export function formatMoney(value: unknown): string {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
  const sign = n < 0 ? "−" : "";
  return `${sign}${moneyFormatter.format(Math.abs(n))} ₽`;
}

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

function formatTime(date: Date): string {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function dayDiff(a: Date, b: Date): number {
  const aDay = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const bDay = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((aDay - bDay) / 86400000);
}

/** "Сегодня, 12:43" / "Вчера, 09:15" / "18 сентября, 18:14" (+" 2025" if past year) */
export function formatPurchaseDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const time = formatTime(date);
  const diff = dayDiff(now, date);
  const thisYear = date.getFullYear() === now.getFullYear();

  if (diff === 0) return `Сегодня, ${time}`;
  if (diff === 1) return `Вчера, ${time}`;

  const dayMonth = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return thisYear ? `${dayMonth}, ${time}` : `${dayMonth} ${date.getFullYear()}, ${time}`;
}

/**
 * Parses "YYYY-MM-DD" as a local calendar date. `new Date("YYYY-MM-DD")`
 * parses as UTC midnight, which shifts the day in non-UTC timezones.
 */
export function parseISODate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateWithMonth(date: Date, now: Date): string {
  const dayMonth = `${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]}`;
  const yearSuffix = date.getFullYear() === now.getFullYear() ? "" : ` ${date.getFullYear()}`;
  return `${dayMonth}${yearSuffix}`;
}

/** "с 18 сентября"; the year is shown only when it differs from `now`. */
export function formatPeriodStart(startISO: string, now: Date = new Date()): string {
  const start = parseISODate(startISO);
  if (!start) return "";
  return formatDateWithMonth(start, now);
}

/** Russian plural for whole days: 1 день / 2 дня / 5 дней / 21 день. */
export function formatDayCount(days: number): string {
  const n = Number.isFinite(days) ? Math.max(0, Math.round(days)) : 0;
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${n} дней`;
  if (mod10 === 1) return `${n} день`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} дня`;
  return `${n} дней`;
}

/**
 * "18.09 — 24.09" (compact, for history lists). A period that started and
 * ended on the same day is shown as a single date: "18.09".
 */
export function formatPeriodRangeShort(startISO: string, endISO: string | null): string {
  const start = parseISODate(startISO);
  const end = endISO === null ? null : parseISODate(endISO);
  if (!start || !end) return "";

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  if (start.getTime() === end.getTime()) return fmt(start);
  return `${fmt(start)} — ${fmt(end)}`;
}
