import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createdAtBounds, type DateRange } from "@/lib/date-range";
import {
  derivePerformance,
  EMPTY_AD_STATS,
  EMPTY_CRM_STATS,
  type CreativeAdStats,
  type CreativeCrmStats,
  type CreativePerformance,
} from "@/lib/ads/attribution";

/** Данные раздела «Аналитика креативов» (ТЗ, Блок 3). */

export type CreativeRow = CreativePerformance & {
  id: string;
  name: string;
  platform: string | null;
  status: string | null;
  previewUrl: string | null;
  campaignName: string | null;
};

export type CreativesData = {
  rows: CreativeRow[];
  /** Сколько лидов CRM за период вообще привязано к креативу. */
  attributedLeads: number;
  totalLeads: number;
  /** Итоги по привязанным креативам. */
  totals: CreativePerformance;
};

type CampaignRef = { id: string; name: string };

export async function loadCreativesAnalytics(
  projectId: string,
  range: DateRange,
): Promise<CreativesData> {
  const supabase = await createSupabaseServerClient();
  const { since, until } = createdAtBounds(range);

  let leadsQuery = supabase
    .from("leads")
    .select("creative_id, status")
    .eq("project_id", projectId);
  if (since) leadsQuery = leadsQuery.gte("created_at", since);
  if (until) leadsQuery = leadsQuery.lt("created_at", until);

  let salesQuery = supabase
    .from("sales")
    .select("creative_id, amount")
    .eq("project_id", projectId);
  if (since) salesQuery = salesQuery.gte("created_at", since);
  if (until) salesQuery = salesQuery.lt("created_at", until);

  let insightsQuery = supabase
    .from("ad_creative_insights_daily")
    .select("creative_id, spend, spend_source, impressions, clicks, leads")
    .eq("project_id", projectId);
  if (range.from) insightsQuery = insightsQuery.gte("date", range.from);
  if (range.to) insightsQuery = insightsQuery.lte("date", range.to);

  const [creativesResult, campaignsResult, leadsResult, salesResult, insightsResult] =
    await Promise.all([
      supabase
        .from("creatives")
        .select("id, name, platform, status, preview_url, campaign_id")
        .eq("project_id", projectId),
      supabase.from("ad_campaigns").select("id, name").eq("project_id", projectId),
      leadsQuery,
      salesQuery,
      insightsQuery,
    ]);

  const campaignById = new Map<string, CampaignRef>(
    (campaignsResult.data ?? []).map((row) => [row.id, { id: row.id, name: row.name }]),
  );

  const adStats = new Map<string, CreativeAdStats>();
  for (const row of insightsResult.data ?? []) {
    const current = adStats.get(row.creative_id) ?? { ...EMPTY_AD_STATS };
    current.spend += Number(row.spend);
    current.spendSource += Number(row.spend_source);
    current.impressions += row.impressions;
    current.clicks += row.clicks;
    current.platformLeads += row.leads;
    adStats.set(row.creative_id, current);
  }

  const crmStats = new Map<string, CreativeCrmStats>();
  let attributedLeads = 0;
  let totalLeads = 0;

  for (const lead of leadsResult.data ?? []) {
    totalLeads += 1;
    if (!lead.creative_id) continue;
    attributedLeads += 1;
    const current = crmStats.get(lead.creative_id) ?? { ...EMPTY_CRM_STATS };
    current.leads += 1;
    if (lead.status !== "new") current.qualified += 1;
    crmStats.set(lead.creative_id, current);
  }

  for (const sale of salesResult.data ?? []) {
    if (!sale.creative_id) continue;
    const current = crmStats.get(sale.creative_id) ?? { ...EMPTY_CRM_STATS };
    current.sales += 1;
    current.revenue += Number(sale.amount);
    crmStats.set(sale.creative_id, current);
  }

  const rows: CreativeRow[] = (creativesResult.data ?? []).map((creative) => {
    const ads = adStats.get(creative.id) ?? EMPTY_AD_STATS;
    const crm = crmStats.get(creative.id) ?? EMPTY_CRM_STATS;
    return {
      id: creative.id,
      name: creative.name,
      platform: creative.platform,
      status: creative.status,
      previewUrl: creative.preview_url,
      campaignName: creative.campaign_id
        ? (campaignById.get(creative.campaign_id)?.name ?? null)
        : null,
      ...derivePerformance(ads, crm),
    };
  });

  // Итог считаем по тем же правилам, что и строку: одна утилита на всё.
  const totalAds = rows.reduce<CreativeAdStats>(
    (sum, row) => ({
      spend: sum.spend + row.spend,
      spendSource: sum.spendSource + row.spendSource,
      impressions: sum.impressions + row.impressions,
      clicks: sum.clicks + row.clicks,
      platformLeads: sum.platformLeads + row.platformLeads,
    }),
    { ...EMPTY_AD_STATS },
  );

  const totalCrm = rows.reduce<CreativeCrmStats>(
    (sum, row) => ({
      leads: sum.leads + row.leads,
      qualified: sum.qualified + row.qualified,
      sales: sum.sales + row.sales,
      revenue: sum.revenue + row.revenue,
    }),
    { ...EMPTY_CRM_STATS },
  );

  return {
    rows,
    attributedLeads,
    totalLeads,
    totals: derivePerformance(totalAds, totalCrm),
  };
}
