import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createdAtBounds, type DateRange } from "@/lib/date-range";
import { LEAD_SOURCE_LABELS } from "@/lib/domain";
import type { Tables } from "@/lib/database.types";

/** Marketing Dashboard (ТЗ, Блок 3): деньги, лиды, продажи и срезы по ним. */

export type MarketingFilters = {
  /** Источник лида: meta, tiktok, whatsapp, other. */
  source: string | null;
  creativeId: string | null;
};

export type SourceRow = {
  key: string;
  label: string;
  leads: number;
  qualified: number;
  sales: number;
  revenue: number;
  conversion: number | null;
};

export type CreativeSlice = {
  id: string;
  name: string;
  leads: number;
  sales: number;
  revenue: number;
  spend: number;
};

export type MarketingData = {
  leads: number;
  qualified: number;
  sales: number;
  revenue: number;
  /** Расход; null, когда его нельзя честно отнести к выбранному срезу. */
  spend: number | null;
  /** Почему расход не показан — объясняем прямо на экране. */
  spendNote: string;
  costPerLead: number | null;
  conversion: number | null;
  averageCheck: number | null;
  roas: number | null;
  bySource: SourceRow[];
  topCreatives: CreativeSlice[];
  funnels: Tables<"saved_funnels">[];
  creatives: { id: string; name: string }[];
};

function divide(numerator: number, denominator: number | null): number | null {
  if (!denominator) return null;
  const value = numerator / denominator;
  return Number.isFinite(value) ? value : null;
}

export async function loadMarketingData(
  projectId: string,
  range: DateRange,
  filters: MarketingFilters,
): Promise<MarketingData> {
  const supabase = await createSupabaseServerClient();
  const { since, until } = createdAtBounds(range);

  let leadsQuery = supabase
    .from("leads")
    .select("status, source, creative_id")
    .eq("project_id", projectId);
  if (since) leadsQuery = leadsQuery.gte("created_at", since);
  if (until) leadsQuery = leadsQuery.lt("created_at", until);
  if (filters.source) leadsQuery = leadsQuery.eq("source", filters.source);
  if (filters.creativeId) leadsQuery = leadsQuery.eq("creative_id", filters.creativeId);

  let salesQuery = supabase
    .from("sales")
    .select("amount, creative_id, lead_id")
    .eq("project_id", projectId);
  if (since) salesQuery = salesQuery.gte("created_at", since);
  if (until) salesQuery = salesQuery.lt("created_at", until);
  if (filters.creativeId) salesQuery = salesQuery.eq("creative_id", filters.creativeId);

  let metricsQuery = supabase
    .from("metrics_daily")
    .select("ad_spend")
    .eq("project_id", projectId);
  if (range.from) metricsQuery = metricsQuery.gte("date", range.from);
  if (range.to) metricsQuery = metricsQuery.lte("date", range.to);

  let creativeSpendQuery = supabase
    .from("ad_creative_insights_daily")
    .select("creative_id, spend")
    .eq("project_id", projectId);
  if (range.from) creativeSpendQuery = creativeSpendQuery.gte("date", range.from);
  if (range.to) creativeSpendQuery = creativeSpendQuery.lte("date", range.to);

  // Для среза по источнику нужны лиды всех продаж: у продажи источника нет,
  // он есть только у её лида.
  let sourceLeadsQuery = supabase
    .from("leads")
    .select("id, source")
    .eq("project_id", projectId);
  if (since) sourceLeadsQuery = sourceLeadsQuery.gte("created_at", since);
  if (until) sourceLeadsQuery = sourceLeadsQuery.lt("created_at", until);

  const [
    leadsResult,
    salesResult,
    metricsResult,
    creativeSpendResult,
    sourceLeadsResult,
    creativesResult,
    funnelsResult,
  ] = await Promise.all([
    leadsQuery,
    salesQuery,
    metricsQuery,
    creativeSpendQuery,
    sourceLeadsQuery,
    supabase
      .from("creatives")
      .select("id, name")
      .eq("project_id", projectId)
      .order("name", { ascending: true }),
    supabase
      .from("saved_funnels")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
  ]);

  const leadRows = leadsResult.data ?? [];
  const saleRows = salesResult.data ?? [];

  const leads = leadRows.length;
  const qualified = leadRows.filter((row) => row.status !== "new").length;
  const sales = saleRows.length;
  const revenue = saleRows.reduce((sum, row) => sum + Number(row.amount), 0);

  // Расход честно относится к срезу только в двух случаях: срез по всему проекту
  // или срез по конкретному креативу. По источникам реклама расход не разделяет.
  const totalSpend = (metricsResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.ad_spend),
    0,
  );
  const spendByCreative = new Map<string, number>();
  for (const row of creativeSpendResult.data ?? []) {
    spendByCreative.set(
      row.creative_id,
      (spendByCreative.get(row.creative_id) ?? 0) + Number(row.spend),
    );
  }

  let spend: number | null = totalSpend;
  let spendNote = "расход проекта за период";

  if (filters.creativeId) {
    spend = spendByCreative.get(filters.creativeId) ?? 0;
    spendNote = "расход этого креатива";
  } else if (filters.source) {
    spend = null;
    spendNote = "реклама не делит расход по источникам";
  }

  // Срез по источникам: продажи привязываем к источнику через лид.
  const sourceByLead = new Map(
    (sourceLeadsResult.data ?? []).map((row) => [row.id, row.source ?? "other"]),
  );

  const sourceStats = new Map<string, SourceRow>();
  const ensureSource = (key: string): SourceRow => {
    const existing = sourceStats.get(key);
    if (existing) return existing;
    const created: SourceRow = {
      key,
      label: LEAD_SOURCE_LABELS[key] ?? key,
      leads: 0,
      qualified: 0,
      sales: 0,
      revenue: 0,
      conversion: null,
    };
    sourceStats.set(key, created);
    return created;
  };

  for (const lead of leadRows) {
    const row = ensureSource(lead.source ?? "other");
    row.leads += 1;
    if (lead.status !== "new") row.qualified += 1;
  }

  for (const sale of saleRows) {
    const source = sale.lead_id ? (sourceByLead.get(sale.lead_id) ?? "other") : "other";
    if (filters.source && source !== filters.source) continue;
    const row = ensureSource(source);
    row.sales += 1;
    row.revenue += Number(sale.amount);
  }

  const bySource = [...sourceStats.values()]
    .map((row) => ({ ...row, conversion: divide(row.sales, row.leads) }))
    .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads);

  // Топ креативов внутри среза.
  const creativeNames = new Map(
    (creativesResult.data ?? []).map((row) => [row.id, row.name]),
  );
  const creativeStats = new Map<string, CreativeSlice>();
  const ensureCreative = (id: string): CreativeSlice => {
    const existing = creativeStats.get(id);
    if (existing) return existing;
    const created: CreativeSlice = {
      id,
      name: creativeNames.get(id) ?? "Креатив",
      leads: 0,
      sales: 0,
      revenue: 0,
      spend: spendByCreative.get(id) ?? 0,
    };
    creativeStats.set(id, created);
    return created;
  };

  for (const lead of leadRows) {
    if (!lead.creative_id) continue;
    ensureCreative(lead.creative_id).leads += 1;
  }
  for (const sale of saleRows) {
    if (!sale.creative_id) continue;
    const row = ensureCreative(sale.creative_id);
    row.sales += 1;
    row.revenue += Number(sale.amount);
  }

  const topCreatives = [...creativeStats.values()]
    .sort((a, b) => b.revenue - a.revenue || b.leads - a.leads)
    .slice(0, 5);

  return {
    leads,
    qualified,
    sales,
    revenue,
    spend,
    spendNote,
    costPerLead: spend === null ? null : divide(spend, leads),
    conversion: divide(sales, leads),
    averageCheck: divide(revenue, sales),
    roas: spend === null ? null : divide(revenue, spend),
    bySource,
    topCreatives,
    funnels: funnelsResult.data ?? [],
    creatives: creativesResult.data ?? [],
  };
}
