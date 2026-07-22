import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addDays, today, type DateRange, previousRange } from "@/lib/date-range";
import {
  applyReturns,
  metricsFromRows,
  type MetricsWithReturns,
  type MetricsRow,
} from "@/lib/metrics";
import { loadMembers, loadProducts } from "@/lib/queries/crm";
import { loadReturnsTotals } from "@/lib/queries/returns";
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

async function loadMetricsRows(projectId: string, bounds: Bounds): Promise<MetricsRow[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("metrics_daily")
    .select("date, leads, qualified, trial_lessons, sales, revenue, ad_spend")
    .eq("project_id", projectId)
    .order("date", { ascending: true });

  if (bounds.from) query = query.gte("date", bounds.from);
  if (bounds.to) query = query.lte("date", bounds.to);

  const { data } = await query;
  return data ?? [];
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
    totals,
    todayRows,
    products,
    returns,
    previousReturns,
  ] = await Promise.all([
    loadMetricsRows(projectId, bounds),
    previous ? loadMetricsRows(projectId, previous) : Promise.resolve([]),
    loadTopManagers(projectId, bounds),
    loadTopSalespeople(projectId, bounds),
    supabase
      .from("metrics_daily")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
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
    hasAnyMetrics: (totals.count ?? 0) > 0,
  };
}
