/**
 * Сквозная аналитика креативов (ТЗ, Блок 3): креатив → лид → продажа.
 * Расход и клики приходят из рекламного кабинета, лиды и продажи — из CRM.
 * Считаем здесь одним местом, чтобы цифры на всех экранах сходились.
 */

/** Что рекламный кабинет знает про креатив за период. */
export type CreativeAdStats = {
  spend: number;
  spendSource: number;
  impressions: number;
  clicks: number;
  /** Лиды, которые насчитала сама Meta. */
  platformLeads: number;
};

/** Что про креатив знает CRM за период. */
export type CreativeCrmStats = {
  leads: number;
  /** Лиды, прошедшие дальше статуса «новый». */
  qualified: number;
  sales: number;
  revenue: number;
};

export type CreativePerformance = CreativeAdStats &
  CreativeCrmStats & {
    /** Цена лида CRM; null, если лидов не было. */
    costPerLead: number | null;
    /** Цена продажи. */
    costPerSale: number | null;
    /** Доля лидов, прошедших квалификацию. */
    qualityRate: number | null;
    /** Конверсия из лида в продажу. */
    conversion: number | null;
    /** Доход на вложенный в этот креатив тенге. */
    roas: number | null;
    /** Выручка минус расход на этот креатив. */
    profit: number;
    /** Кликабельность. */
    ctr: number | null;
    /**
     * Расхождение между лидами кабинета и лидами CRM.
     * Кабинет считает заявки, CRM — тех, кто дошёл; разница показывает потери.
     */
    reachedCrm: number | null;
  };

export const EMPTY_AD_STATS: CreativeAdStats = {
  spend: 0,
  spendSource: 0,
  impressions: 0,
  clicks: 0,
  platformLeads: 0,
};

export const EMPTY_CRM_STATS: CreativeCrmStats = {
  leads: 0,
  qualified: 0,
  sales: 0,
  revenue: 0,
};

function divide(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  const value = numerator / denominator;
  return Number.isFinite(value) ? value : null;
}

export function derivePerformance(
  ads: CreativeAdStats,
  crm: CreativeCrmStats,
): CreativePerformance {
  return {
    ...ads,
    ...crm,
    costPerLead: divide(ads.spend, crm.leads),
    costPerSale: divide(ads.spend, crm.sales),
    qualityRate: divide(crm.qualified, crm.leads),
    conversion: divide(crm.sales, crm.leads),
    roas: divide(crm.revenue, ads.spend),
    profit: crm.revenue - ads.spend,
    ctr: divide(ads.clicks, ads.impressions),
    reachedCrm: divide(crm.leads, ads.platformLeads),
  };
}

/**
 * Порядок в таблице: сначала то, что приносит деньги.
 * Креативы без продаж сортируем по расходу — их надо увидеть и выключить.
 */
export function compareByValue(a: CreativePerformance, b: CreativePerformance): number {
  if (b.revenue !== a.revenue) return b.revenue - a.revenue;
  return b.spend - a.spend;
}
