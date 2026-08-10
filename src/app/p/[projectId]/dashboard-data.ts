import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
import { addDays, today, type DateRange, previousRange } from "@/lib/date-range";
import { PROJECT_TZ_OFFSET_HOURS } from "@/lib/format";
import {
  applyReturns,
  metricsFromRows,
  type MetricsWithReturns,
  type MetricsRow,
} from "@/lib/metrics";
import { loadMembers, loadProducts } from "@/lib/queries/crm";
import { loadReturnsTotals } from "@/lib/queries/returns";
import { isVacancyCampaign } from "@/lib/ads/purpose";
import type { Product } from "@/lib/inventory";

/** Лид считается доведённым до пробного, начиная с этих статусов. */
const TRIAL_STATUSES = ["trial_booked", "trial_done", "sale"];
const TOP_LIMIT = 5;

type Bounds = { from: string | null; to: string | null };

/** Границы по created_at: включительно от начала «от» до конца «до». */
function timestampBounds(bounds: Bounds) {
  return {
    since: bounds.from ? `${bounds.from}T00:00:00` : null,
    until: bounds.to ? `${addDays(bounds.to, 1)}T00:00:00` : null,
  };
}

/** Дата события в часовом поясе проекта (Алматы, фиксированный UTC+5). */
function projectDate(iso: string): string {
  return new Date(new Date(iso).getTime() + PROJECT_TZ_OFFSET_HOURS * 3_600_000)
    .toISOString()
    .slice(0, 10);
}

/**
 * Дни Главной — из реальных данных, а не из metrics_daily.
 * Лиды и воронка из таблицы leads, продажи и выручка из sales, расход из
 * ad_insights_daily (уже в валюте проекта). Так Главная сходится с разделами
 * «Лиды», «Продажи» и «Аналитика», которые читают те же таблицы.
 */
async function loadMetricsRows(projectId: string, bounds: Bounds): Promise<MetricsRow[]> {
  const supabase = await createSupabaseServerClient();
  const { since, until } = timestampBounds(bounds);

  const [leads, sales, insights, campaigns] = await Promise.all([
    fetchAllRows((from, to) => {
      let q = supabase.from("leads").select("created_at, status").eq("project_id", projectId);
      if (since) q = q.gte("created_at", since);
      if (until) q = q.lt("created_at", until);
      return q.order("id").range(from, to);
    }),
    fetchAllRows((from, to) => {
      let q = supabase.from("sales").select("created_at, amount").eq("project_id", projectId);
      if (since) q = q.gte("created_at", since);
      if (until) q = q.lt("created_at", until);
      return q.order("id").range(from, to);
    }),
    fetchAllRows((from, to) => {
      let q = supabase
        .from("ad_insights_daily")
        .select("date, spend, campaign_id")
        .eq("project_id", projectId);
      if (bounds.from) q = q.gte("date", bounds.from);
      if (bounds.to) q = q.lte("date", bounds.to);
      return q.order("id").range(from, to);
    }),
    fetchAllRows((from, to) =>
      supabase
        .from("ad_campaigns")
        .select("id, name")
        .eq("project_id", projectId)
        .order("id")
        .range(from, to),
    ),
  ]);

  // Кампании найма (вакансии) в экономику курса не мешаем: их расход раздувает
  // цену лида и занижает прибыль, а заявки соискателей в CRM курса не попадают.
  const vacancyCampaignIds = new Set(
    campaigns.filter((c) => isVacancyCampaign(c.name)).map((c) => c.id),
  );

  const byDate = new Map<string, MetricsRow>();
  const ensure = (date: string): MetricsRow => {
    let row = byDate.get(date);
    if (!row) {
      row = { date, leads: 0, qualified: 0, trial_lessons: 0, sales: 0, revenue: 0, ad_spend: 0 };
      byDate.set(date, row);
    }
    return row;
  };

  for (const lead of leads) {
    const row = ensure(projectDate(lead.created_at));
    row.leads += 1;
    if (lead.status !== "new") row.qualified += 1;
    if (TRIAL_STATUSES.includes(lead.status)) row.trial_lessons += 1;
  }
  for (const sale of sales) {
    const row = ensure(projectDate(sale.created_at));
    row.sales += 1;
    row.revenue += Number(sale.amount);
  }
  for (const insight of insights) {
    if (insight.campaign_id && vacancyCampaignIds.has(insight.campaign_id)) continue;
    ensure(insight.date).ad_spend += Number(insight.spend);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Имена сотрудников берём из состава проекта: он кэширован и запрашивается один раз. */
async function loadNames(projectId: string): Promise<Map<string, string>> {
  const members = await loadMembers(projectId);
  return new Map(members.map((member) => [member.userId, member.fullName]));
}

export type ManagerStat = { id: string; name: string; leads: number; trials: number };
export type SalespersonStat = { id: string; name: string; count: number; amount: number };

/** Топ менеджеров: кто больше записал лидов на пробный урок (ТЗ, раздел 4). */
async function loadTopManagers(projectId: string, bounds: Bounds): Promise<ManagerStat[]> {
  const supabase = await createSupabaseServerClient();
  const { since, until } = timestampBounds(bounds);

  let query = supabase
    .from("leads")
    .select("assigned_to, status")
    .eq("project_id", projectId)
    .not("assigned_to", "is", null);

  if (since) query = query.gte("created_at", since);
  if (until) query = query.lt("created_at", until);

  const { data } = await query;
  const stats = new Map<string, { leads: number; trials: number }>();

  for (const row of data ?? []) {
    if (!row.assigned_to) continue;
    const current = stats.get(row.assigned_to) ?? { leads: 0, trials: 0 };
    current.leads += 1;
    if (TRIAL_STATUSES.includes(row.status)) current.trials += 1;
    stats.set(row.assigned_to, current);
  }

  const names = await loadNames(projectId);

  return [...stats.entries()]
    .sort((a, b) => b[1].trials - a[1].trials || b[1].leads - a[1].leads)
    .slice(0, TOP_LIMIT)
    .map(([id, value]) => ({
      id,
      name: names.get(id) ?? "Сотрудник",
      leads: value.leads,
      trials: value.trials,
    }));
}

/** Топ продажников: кто больше закрыл продаж курса (ТЗ, раздел 4). */
async function loadTopSalespeople(
  projectId: string,
  bounds: Bounds,
): Promise<SalespersonStat[]> {
  const supabase = await createSupabaseServerClient();
  const { since, until } = timestampBounds(bounds);

  let query = supabase
    .from("sales")
    .select("seller_id, amount")
    .eq("project_id", projectId)
    .not("seller_id", "is", null);

  if (since) query = query.gte("created_at", since);
  if (until) query = query.lt("created_at", until);

  const { data } = await query;
  const stats = new Map<string, { count: number; amount: number }>();

  for (const row of data ?? []) {
    if (!row.seller_id) continue;
    const current = stats.get(row.seller_id) ?? { count: 0, amount: 0 };
    current.count += 1;
    current.amount += Number(row.amount);
    stats.set(row.seller_id, current);
  }

  const names = await loadNames(projectId);

  return [...stats.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .slice(0, TOP_LIMIT)
    .map(([id, value]) => ({
      id,
      name: names.get(id) ?? "Сотрудник",
      count: value.count,
      amount: value.amount,
    }));
}

export type DashboardData = {
  rows: MetricsRow[];
  current: MetricsWithReturns;
  previous: MetricsWithReturns | null;
  topManagers: ManagerStat[];
  topSalespeople: SalespersonStat[];
  /** Строка за сегодня — для «Живой сводки дня» ниши ecommerce. */
  today: MetricsRow | null;
  /** Каталог склада; у ниши education он пуст. */
  products: Product[];
  /** Есть ли у проекта данные вообще — чтобы отличить пустой период от пустого проекта. */
  hasAnyMetrics: boolean;
};

/**
 * Данные Главной. Не зависят от контекста проекта, поэтому страница запускает их
 * одновременно с ним: все запросы уходят одной волной, а не двумя.
 */
export async function loadDashboardData(
  projectId: string,
  range: DateRange,
): Promise<DashboardData> {
  const supabase = await createSupabaseServerClient();
  const bounds: Bounds = { from: range.from, to: range.to };
  const previous = previousRange(range);

  // Состав проекта запускаем сразу: топы дождутся того же кэшированного запроса,
  // а не пойдут за именами отдельной волной.
  void loadMembers(projectId);

  const currentDay = today();

  const [
    rows,
    previousRows,
    topManagers,
    topSalespeople,
    leadsExist,
    salesExist,
    todayRows,
    products,
    returns,
    previousReturns,
  ] = await Promise.all([
    loadMetricsRows(projectId, bounds),
    previous ? loadMetricsRows(projectId, previous) : Promise.resolve([]),
    loadTopManagers(projectId, bounds),
    loadTopSalespeople(projectId, bounds),
    supabase.from("leads").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase.from("sales").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    loadMetricsRows(projectId, { from: currentDay, to: currentDay }),
    loadProducts(projectId),
    loadReturnsTotals(projectId, bounds),
    previous
      ? loadReturnsTotals(projectId, previous)
      : Promise.resolve({ count: 0, amount: 0 }),
  ]);

  return {
    rows,
    current: applyReturns(metricsFromRows(rows), returns),
    previous: previous ? applyReturns(metricsFromRows(previousRows), previousReturns) : null,
    topManagers,
    topSalespeople,
    today: todayRows[0] ?? null,
    products,
    // Есть ли у проекта данные вообще: отличить пустой период от пустого проекта.
    hasAnyMetrics: (leadsExist.count ?? 0) > 0 || (salesExist.count ?? 0) > 0,
  };
}
