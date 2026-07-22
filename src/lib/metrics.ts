import type { Tables } from "./database.types";

/**
 * Производные метрики считаются только здесь (ТЗ, раздел 12).
 * Источник цифр — metrics_daily, поэтому переход с демо на реальную рекламу не меняет UI.
 */

export type MetricsRow = Pick<
  Tables<"metrics_daily">,
  "date" | "leads" | "qualified" | "trial_lessons" | "sales" | "revenue" | "ad_spend"
>;

export type MetricsTotals = {
  leads: number;
  qualified: number;
  trialLessons: number;
  sales: number;
  revenue: number;
  adSpend: number;
};

export type DerivedMetrics = MetricsTotals & {
  /** Доход минус расход на рекламу. */
  netProfit: number;
  /** Цена лида; null, если лидов не было. */
  costPerLead: number | null;
  /** Доля продаж от лидов (0…1). */
  conversion: number | null;
  /** Доход на каждый вложенный в рекламу тенге. */
  roas: number | null;
  /** Возврат на рекламные инвестиции (0…1 и выше). */
  roi: number | null;
  /** Средний чек продажи. */
  averageCheck: number | null;
  /** Доходимость лида до пробного урока (education). */
  trialRate: number | null;
};

const EMPTY_TOTALS: MetricsTotals = {
  leads: 0,
  qualified: 0,
  trialLessons: 0,
  sales: 0,
  revenue: 0,
  adSpend: 0,
};

function divide(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  const value = numerator / denominator;
  return Number.isFinite(value) ? value : null;
}

export function sumMetrics(rows: readonly MetricsRow[]): MetricsTotals {
  return rows.reduce<MetricsTotals>(
    (totals, row) => ({
      leads: totals.leads + row.leads,
      qualified: totals.qualified + row.qualified,
      trialLessons: totals.trialLessons + row.trial_lessons,
      sales: totals.sales + row.sales,
      revenue: totals.revenue + Number(row.revenue),
      adSpend: totals.adSpend + Number(row.ad_spend),
    }),
    { ...EMPTY_TOTALS },
  );
}

export function deriveMetrics(totals: MetricsTotals): DerivedMetrics {
  return {
    ...totals,
    netProfit: totals.revenue - totals.adSpend,
    costPerLead: divide(totals.adSpend, totals.leads),
    conversion: divide(totals.sales, totals.leads),
    roas: divide(totals.revenue, totals.adSpend),
    roi: divide(totals.revenue - totals.adSpend, totals.adSpend),
    averageCheck: divide(totals.revenue, totals.sales),
    trialRate: divide(totals.trialLessons, totals.leads),
  };
}

export function metricsFromRows(rows: readonly MetricsRow[]): DerivedMetrics {
  return deriveMetrics(sumMetrics(rows));
}

/** Итог возвратов за период. Возвраты живут отдельной таблицей и не правят metrics_daily. */
export type ReturnsTotals = { count: number; amount: number };

export const NO_RETURNS: ReturnsTotals = { count: 0, amount: 0 };

export type MetricsWithReturns = DerivedMetrics & {
  returnsCount: number;
  returnsAmount: number;
  /** Доход за вычетом возвращённых денег. */
  netRevenue: number;
  /** Доля возвращённых денег от дохода. */
  refundRate: number | null;
};

/**
 * Возвраты уменьшают реальный доход, поэтому прибыль и средний чек считаем от чистого дохода.
 * Само metrics_daily не трогаем: там лежит то, что произошло в рекламе и продажах,
 * а возврат — отдельное событие со своей историей (ТЗ, раздел 3, пункт 4).
 */
export function applyReturns(
  metrics: DerivedMetrics,
  returns: ReturnsTotals = NO_RETURNS,
): MetricsWithReturns {
  const netRevenue = metrics.revenue - returns.amount;
  return {
    ...metrics,
    netRevenue,
    netProfit: netRevenue - metrics.adSpend,
    roas: divide(netRevenue, metrics.adSpend),
    roi: divide(netRevenue - metrics.adSpend, metrics.adSpend),
    averageCheck: divide(netRevenue, metrics.sales),
    returnsCount: returns.count,
    returnsAmount: returns.amount,
    refundRate: divide(returns.amount, metrics.revenue),
  };
}

/**
 * Относительное изменение к прошлому периоду.
 * null, если сравнивать не с чем — не показываем «+100 %» на пустом месте.
 */
export function changeRatio(current: number, previous: number): number | null {
  if (!previous) return null;
  return (current - previous) / Math.abs(previous);
}

/** Больше — лучше почти везде, кроме расходов и цены лида. */
export type MetricDirection = "up-good" | "down-good" | "neutral";

export function deltaTone(
  change: number | null,
  direction: MetricDirection,
): "positive" | "negative" | "neutral" {
  if (change === null || change === 0 || direction === "neutral") return "neutral";
  const isUp = change > 0;
  const good = direction === "up-good" ? isUp : !isUp;
  return good ? "positive" : "negative";
}
