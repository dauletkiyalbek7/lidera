import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/date-range";

/** Данные раздела «Реклама» (ТЗ, Блок 3). */

export type CampaignRow = {
  id: string;
  externalId: string;
  name: string;
  status: string | null;
  objective: string | null;
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  currency: string | null;
  syncedAt: string;
  /** Показатели за выбранный период. */
  spend: number;
  spendSource: number;
  impressions: number;
  clicks: number;
  leads: number;
};

export type AdsTotals = {
  spend: number;
  spendSource: number;
  impressions: number;
  clicks: number;
  leads: number;
  /** Валюта кабинета, если она у всех кампаний одна. */
  sourceCurrency: string | null;
};

export async function loadAdsData(
  projectId: string,
  range: DateRange,
  platform: string,
): Promise<{ campaigns: CampaignRow[]; totals: AdsTotals; lastSyncedAt: string | null }> {
  const supabase = await createSupabaseServerClient();

  const { data: campaigns } = await supabase
    .from("ad_campaigns")
    .select("*")
    .eq("project_id", projectId)
    .eq("platform", platform)
    .order("name", { ascending: true });

  const list = campaigns ?? [];
  if (list.length === 0) {
    return {
      campaigns: [],
      totals: {
        spend: 0,
        spendSource: 0,
        impressions: 0,
        clicks: 0,
        leads: 0,
        sourceCurrency: null,
      },
      lastSyncedAt: null,
    };
  }

  let insightsQuery = supabase
    .from("ad_insights_daily")
    .select("campaign_id, spend, spend_source, impressions, clicks, leads, currency")
    .eq("project_id", projectId)
    .in(
      "campaign_id",
      list.map((campaign) => campaign.id),
    );

  if (range.from) insightsQuery = insightsQuery.gte("date", range.from);
  if (range.to) insightsQuery = insightsQuery.lte("date", range.to);

  const { data: insights } = await insightsQuery;

  const byCampaign = new Map<
    string,
    { spend: number; spendSource: number; impressions: number; clicks: number; leads: number }
  >();

  for (const row of insights ?? []) {
    const current = byCampaign.get(row.campaign_id) ?? {
      spend: 0,
      spendSource: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
    };
    current.spend += Number(row.spend);
    current.spendSource += Number(row.spend_source);
    current.impressions += row.impressions;
    current.clicks += row.clicks;
    current.leads += row.leads;
    byCampaign.set(row.campaign_id, current);
  }

  const rows: CampaignRow[] = list.map((campaign) => {
    const stats = byCampaign.get(campaign.id);
    return {
      id: campaign.id,
      externalId: campaign.external_id,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      dailyBudget: campaign.daily_budget === null ? null : Number(campaign.daily_budget),
      lifetimeBudget:
        campaign.lifetime_budget === null ? null : Number(campaign.lifetime_budget),
      currency: campaign.currency,
      syncedAt: campaign.synced_at,
      spend: stats?.spend ?? 0,
      spendSource: stats?.spendSource ?? 0,
      impressions: stats?.impressions ?? 0,
      clicks: stats?.clicks ?? 0,
      leads: stats?.leads ?? 0,
    };
  });

  const currencies = new Set(list.map((campaign) => campaign.currency).filter(Boolean));

  return {
    campaigns: rows,
    totals: rows.reduce<AdsTotals>(
      (sum, row) => ({
        spend: sum.spend + row.spend,
        spendSource: sum.spendSource + row.spendSource,
        impressions: sum.impressions + row.impressions,
        clicks: sum.clicks + row.clicks,
        leads: sum.leads + row.leads,
        sourceCurrency: sum.sourceCurrency,
      }),
      {
        spend: 0,
        spendSource: 0,
        impressions: 0,
        clicks: 0,
        leads: 0,
        sourceCurrency: currencies.size === 1 ? ([...currencies][0] as string) : null,
      },
    ),
    lastSyncedAt: list.reduce<string | null>(
      (latest, campaign) =>
        !latest || campaign.synced_at > latest ? campaign.synced_at : latest,
      null,
    ),
  };
}
