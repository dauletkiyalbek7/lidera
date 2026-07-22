/**
 * Оценка креатива по цене лида (ТЗ, Блок 3: рекомендации что включить/выключить).
 *
 * Главное правило владельца: лид дороже лимита (по умолчанию $3) — креатив
 * выключаем. Вокруг лимита строим четыре уровня, чтобы было видно не только
 * «плохих», но и лучших, которым стоит добавить бюджет.
 *
 * Считаем по данным рекламного кабинета (расход и лиды Meta): CRM-привязка
 * появляется не сразу, а решать про бюджет надо уже сегодня.
 */

export type CreativeStatus = "top" | "ok" | "weak" | "off" | "nodata";

export type StatusVerdict = {
  status: CreativeStatus;
  /** Цена лида, по которой вынесли вердикт; null — если лидов нет. */
  cpl: number | null;
};

/** Сколько лидов нужно, чтобы назвать креатив «топом», а не случайной удачей. */
const TOP_MIN_LEADS = 3;
/** Доли лимита для границ уровней. */
const TOP_SHARE = 0.5;
const OK_SHARE = 0.8;

export function evaluateCreative(
  spendSource: number,
  platformLeads: number,
  limit: number,
): StatusVerdict {
  if (platformLeads <= 0) {
    // Потратил хотя бы на один лид по лимиту и не привёл ни одного — выключаем.
    // Меньше потратил — рано судить, пусть наберёт статистику.
    return { status: spendSource >= limit ? "off" : "nodata", cpl: null };
  }

  const cpl = spendSource / platformLeads;

  if (cpl > limit) return { status: "off", cpl };
  if (cpl > limit * OK_SHARE) return { status: "weak", cpl };
  if (cpl > limit * TOP_SHARE) return { status: "ok", cpl };

  // Дёшево — но «топом» зовём только при заметном объёме лидов.
  return { status: platformLeads >= TOP_MIN_LEADS ? "top" : "ok", cpl };
}

export type StatusTone = "top" | "positive" | "warning" | "negative" | "neutral";

export const STATUS_META: Record<
  CreativeStatus,
  { label: string; tone: StatusTone; advice: string }
> = {
  top: {
    label: "Топ",
    tone: "top",
    advice: "Работает отлично — можно добавить бюджет",
  },
  ok: {
    label: "Норма",
    tone: "positive",
    advice: "Цена лида в пределах нормы",
  },
  weak: {
    label: "Слабый",
    tone: "warning",
    advice: "Близко к лимиту — держите на контроле",
  },
  off: {
    label: "Выключить",
    tone: "negative",
    advice: "Дороже лимита или тратит без лидов — выключите",
  },
  nodata: {
    label: "Мало данных",
    tone: "neutral",
    advice: "Ещё не набрал статистику для оценки",
  },
};

/** Порядок сортировки: сначала то, что требует действия, потом лучшие. */
export const STATUS_ORDER: Record<CreativeStatus, number> = {
  off: 0,
  weak: 1,
  top: 2,
  ok: 3,
  nodata: 4,
};
