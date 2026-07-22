/**
 * Диапазон дат — общий для всех разделов (ТЗ, раздел 5).
 * Значение живёт в URL, поэтому серверные страницы читают его напрямую из searchParams.
 */

/** Часовой пояс расчётов. Позже станет настройкой проекта. */
export const PROJECT_TIME_ZONE = "Asia/Almaty";

export const RANGE_PRESETS = [
  "today",
  "yesterday",
  "last7",
  "last14",
  "this-week",
  "this-month",
  "last-week",
  "last-month",
  "all",
  "custom",
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number];

export const RANGE_PRESET_LABELS: Record<RangePreset, string> = {
  today: "Сегодня",
  yesterday: "Вчера",
  last7: "Последние 7 дней",
  last14: "Последние 14 дней",
  "this-week": "Эта неделя",
  "this-month": "Этот месяц",
  "last-week": "Прошлая неделя",
  "last-month": "Прошлый месяц",
  all: "За всё время",
  custom: "Произвольный период",
};

export const DEFAULT_RANGE_PRESET: RangePreset = "last7";

/** from/to включительно; null во «За всё время». */
export type DateRange = {
  preset: RangePreset;
  from: string | null;
  to: string | null;
  label: string;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** «Сегодня» в часовом поясе проекта, а не в UTC сервера. */
export function today(timeZone: string = PROJECT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function toUtc(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * MS_PER_DAY);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY);
}

/** Неделя начинается с понедельника. */
export function startOfWeek(date: string): string {
  const weekday = new Date(toUtc(date)).getUTCDay();
  const shift = weekday === 0 ? 6 : weekday - 1;
  return addDays(date, -shift);
}

export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function endOfMonth(date: string): string {
  const [year, month] = date.split("-").map(Number);
  return fromUtc(Date.UTC(year, month, 0));
}

/** Первое число прошлого месяца — начало окна синхронизации рекламы. */
export function startOfPreviousMonth(date: string): string {
  return startOfMonth(addDays(startOfMonth(date), -1));
}

export function asRangePreset(value: string | undefined): RangePreset {
  return value && (RANGE_PRESETS as readonly string[]).includes(value)
    ? (value as RangePreset)
    : DEFAULT_RANGE_PRESET;
}

/** Превращает выбор пользователя в конкретные границы дат. */
export function resolveDateRange(
  preset: RangePreset,
  customFrom?: string,
  customTo?: string,
  now: string = today(),
): DateRange {
  const label = RANGE_PRESET_LABELS[preset];

  switch (preset) {
    case "today":
      return { preset, from: now, to: now, label };
    case "yesterday": {
      const day = addDays(now, -1);
      return { preset, from: day, to: day, label };
    }
    case "last7":
      return { preset, from: addDays(now, -6), to: now, label };
    case "last14":
      return { preset, from: addDays(now, -13), to: now, label };
    case "this-week":
      return { preset, from: startOfWeek(now), to: now, label };
    case "this-month":
      return { preset, from: startOfMonth(now), to: now, label };
    case "last-week": {
      const from = addDays(startOfWeek(now), -7);
      return { preset, from, to: addDays(from, 6), label };
    }
    case "last-month": {
      const from = startOfMonth(addDays(startOfMonth(now), -1));
      return { preset, from, to: endOfMonth(from), label };
    }
    case "all":
      return { preset, from: null, to: null, label };
    case "custom": {
      const valid = customFrom && customTo && isIsoDate(customFrom) && isIsoDate(customTo);
      if (!valid) return resolveDateRange(DEFAULT_RANGE_PRESET, undefined, undefined, now);
      const [from, to] =
        customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom];
      return { preset, from, to, label };
    }
  }
}

/**
 * Предыдущий период такой же длины — для сравнения «против прошлого периода».
 * Для «За всё время» сравнивать не с чем.
 */
export function previousRange(range: DateRange): { from: string; to: string } | null {
  if (!range.from || !range.to) return null;
  const length = daysBetween(range.from, range.to) + 1;
  return { from: addDays(range.from, -length), to: addDays(range.to, -length) };
}

/**
 * Смещение часового пояса проекта на конкретную дату, в виде «+05:00».
 * Считаем на дату, а не раз навсегда: пояс с переходом на летнее время
 * иначе сдвинет границы периода на час.
 */
export function zoneOffset(date: string, timeZone: string = PROJECT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(`${date}T12:00:00Z`));

  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  const offset = name.replace("GMT", "");
  return offset || "+00:00";
}

/**
 * Границы для колонок created_at (timestamptz): от начала дня «от»
 * до начала дня, следующего за «до».
 *
 * Смещение обязательно: без него Postgres читает «2026-07-22T00:00:00» как UTC,
 * и всё, что произошло в проекте между полуночью и пятью утра, выпадает из периода.
 */
export function createdAtBounds(range: { from: string | null; to: string | null }): {
  since: string | null;
  until: string | null;
} {
  const until = range.to ? addDays(range.to, 1) : null;
  return {
    since: range.from ? `${range.from}T00:00:00${zoneOffset(range.from)}` : null,
    until: until ? `${until}T00:00:00${zoneOffset(until)}` : null,
  };
}

/**
 * Дни периода списком — для табеля посещаемости.
 * limit ограничивает хвост: показывать 300 колонок бессмысленно, берём последние.
 */
export function enumerateDays(
  range: { from: string | null; to: string | null },
  limit: number,
  now: string = today(),
): string[] {
  const to = range.to ?? now;
  const from = range.from ?? addDays(to, -(limit - 1));
  const total = Math.max(1, daysBetween(from, to) + 1);
  const start = total > limit ? addDays(to, -(limit - 1)) : from;

  const days: string[] = [];
  for (let day = start; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Понедельник — 1, воскресенье — 7: как в графике работы. */
export function weekdayOf(date: string): number {
  const weekday = new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

/** Читает диапазон из query-параметров страницы. */
export function readDateRange(searchParams: {
  range?: string;
  from?: string;
  to?: string;
}): DateRange {
  return resolveDateRange(asRangePreset(searchParams.range), searchParams.from, searchParams.to);
}
