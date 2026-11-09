// Дати — рядки YYYY-MM-DD. Рахуємо в UTC, щоб перехід на літній час не зсував дні.
const DAY_MS = 86_400_000;
const MONTHS = ["січ", "лют", "бер", "кві", "тра", "чер", "лип", "сер", "вер", "жов", "лис", "гру"];
export const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

const toMs = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export const addDays = (iso: string, days: number) =>
  new Date(toMs(iso) + days * DAY_MS).toISOString().slice(0, 10);

export const diffDays = (from: string, to: string) => Math.round((toMs(to) - toMs(from)) / DAY_MS);

/** 0 — понеділок, 6 — неділя. */
export const weekdayIndex = (iso: string) => (new Date(toMs(iso)).getUTCDay() + 6) % 7;

export const mondayOf = (iso: string) => addDays(iso, -weekdayIndex(iso));

/** Номер тижня за ISO 8601: тиждень належить року, на який припадає його четвер. */
export function isoWeek(iso: string): number {
  const thursday = addDays(mondayOf(iso), 3);
  return Math.floor(diffDays(`${thursday.slice(0, 4)}-01-01`, thursday) / 7) + 1;
}

export function dueLabel(dueOn: string, today: string): string {
  if (!dueOn) return "Дату здачі не вказано";
  const days = diffDays(today, dueOn);
  if (days < 0) return `Прострочено на ${-days} дн.`;
  return days === 0 ? "Здача сьогодні" : `До здачі ${days} дн.`;
}

export const dayOfMonth = (iso: string) => Number(iso.slice(8, 10));

export const formatShort = (iso: string) => `${dayOfMonth(iso)} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

export function formatSpan(start: string, end: string): string {
  return start === end ? formatShort(start) : `${formatShort(start)} – ${formatShort(end)}`;
}
