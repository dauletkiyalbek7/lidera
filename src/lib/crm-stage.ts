/**
 * Единая палитра этапов сделки (ТЗ, Блок 2).
 * Один источник цвета для CRM-воронки (канбан) и таблицы лидов, чтобы этап
 * читался одинаково: холодный «новый» → зелёная «продажа». Держим здесь, а не
 * в компоненте канбана, чтобы таблицы могли красить аватар лида в цвет этапа.
 */

export type Stage = {
  /** Точка/акцент этапа. */
  dot: string;
  /** Верхняя полоса колонки канбана. */
  bar: string;
  /** Мягкий фон (шапка колонки, аватар). */
  soft: string;
  /** Левый акцент карточки. */
  edge: string;
  /** Цвет текста/инициалов. */
  text: string;
};

const STAGE: Record<string, Stage> = {
  new: { dot: "bg-slate-400", bar: "bg-slate-300", soft: "bg-slate-50", edge: "border-l-slate-300", text: "text-slate-600" },
  qualified: { dot: "bg-sky-500", bar: "bg-sky-400", soft: "bg-sky-50", edge: "border-l-sky-400", text: "text-sky-700" },
  processed: { dot: "bg-sky-500", bar: "bg-sky-400", soft: "bg-sky-50", edge: "border-l-sky-400", text: "text-sky-700" },
  trial_booked: { dot: "bg-amber-500", bar: "bg-amber-400", soft: "bg-amber-50", edge: "border-l-amber-400", text: "text-amber-700" },
  trial_done: { dot: "bg-violet-500", bar: "bg-violet-400", soft: "bg-violet-50", edge: "border-l-violet-400", text: "text-violet-700" },
  sale: { dot: "bg-emerald-500", bar: "bg-emerald-400", soft: "bg-emerald-50", edge: "border-l-emerald-400", text: "text-emerald-700" },
};

const FALLBACK: Stage = {
  dot: "bg-slate-400",
  bar: "bg-slate-300",
  soft: "bg-slate-50",
  edge: "border-l-slate-300",
  text: "text-slate-600",
};

export const stageOf = (status: string): Stage => STAGE[status] ?? FALLBACK;
