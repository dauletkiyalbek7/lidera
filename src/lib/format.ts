/**
 * Форматирование сумм, чисел и дат — централизованно (ТЗ, раздел 12).
 * Валюта приходит из проекта, по умолчанию тенге.
 */

export const DEFAULT_CURRENCY = "KZT";
const LOCALE = "ru-RU";

export function formatMoney(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  options: { compact?: boolean; fractionDigits?: number } = {},
): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    // Без narrowSymbol тенге печатается как «KZT», а не «₸».
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: options.fractionDigits ?? 0,
    notation: options.compact ? "compact" : "standard",
  }).format(amount);
}

/**
 * Деньги рекламного кабинета: доллары показываем с центами, тенге — целыми.
 * В долларах суммы мелкие, и «$29» вместо «$28,96» съедает разницу между кампаниями.
 */
export function formatAdMoney(amount: number, currency: string): string {
  return formatMoney(amount, currency, { fractionDigits: currency === "USD" ? 2 : 0 });
}

/** Символ валюты проекта — для подписей полей ввода: «Сумма, ₸». */
export function currencySymbol(currency: string = DEFAULT_CURRENCY): string {
  const parts = new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).formatToParts(0);
  return parts.find((part) => part.type === "currency")?.value ?? currency;
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits }).format(value);
}

/** value — доля (0.42), а не проценты. */
export function formatPercent(value: number | null, maximumFractionDigits = 1): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(LOCALE, {
    style: "percent",
    maximumFractionDigits,
  }).format(value);
}

export function formatRatio(value: number | null, maximumFractionDigits = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits }).format(value)}×`;
}

export function formatMoneyOrDash(
  amount: number | null,
  currency: string = DEFAULT_CURRENCY,
): string {
  if (amount === null || !Number.isFinite(amount)) return "—";
  return formatMoney(amount, currency);
}

/** ISO-дата (YYYY-MM-DD) → «21 июля 2026». */
export function formatDate(date: string, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${date.slice(0, 10)}T00:00:00Z`));
}

export function formatDateShort(date: string): string {
  return formatDate(date, { day: "numeric", month: "short", year: undefined });
}

export function formatDateRange(from: string | null, to: string | null): string {
  if (!from || !to) return "За всё время";
  if (from === to) return formatDate(from);
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const fromLabel = sameYear
    ? formatDate(from, { day: "numeric", month: "long", year: undefined })
    : formatDate(from);
  return `${fromLabel} — ${formatDate(to)}`;
}

/** Знаковое изменение к прошлому периоду: «+12,4 %». */
export function formatDelta(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat(LOCALE, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value)}`;
}

/** Русское склонение: 1 лид, 2 лида, 5 лидов. */
export function plural(count: number, forms: [string, string, string]): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}
