export const BUDGET = 15000;
export const APP_VERSION = "1.0.0";

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

/** "05 сентября — 19 сентября"; the year is shown only when it differs from `now`. */
export function formatPeriodRange(startISO: string, endISO: string, now: Date = new Date()): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";

  const sameYear = start.getFullYear() === end.getFullYear();
  const startStr = `${String(start.getDate()).padStart(2, "0")} ${MONTHS[start.getMonth()]}`;
  const endStr = `${String(end.getDate()).padStart(2, "0")} ${MONTHS[end.getMonth()]}`;
  const yearSuffix =
    start.getFullYear() === now.getFullYear() && sameYear ? "" : ` ${start.getFullYear()}`;

  if (sameYear) return `${startStr} — ${endStr}${yearSuffix}`;
  return `${startStr} ${start.getFullYear()} — ${endStr} ${end.getFullYear()}`;
}

/** "05.09 — 19.09" (compact, for history lists) */
export function formatPeriodRangeShort(startISO: string, endISO: string): string {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";

  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  return `${fmt(start)} — ${fmt(end)}`;
}
