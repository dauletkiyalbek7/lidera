import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/date-range";
import { campaignPurpose, type CampaignPurpose } from "@/lib/ads/purpose";

/** Данные раздела «Реклама» (ТЗ, Блок 3). */

/** Сырые счётчики из кабинета — всё остальное считается из них. */
export type AdCounters = {
  spend: number;
  spendSource: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
};

/**
 * Показатели, которые в Ads Manager отдельными колонками.
 * Meta их тоже считает, но мы выводим сами: так они не разъедутся с расходом,
 * который мы пересчитываем в валюту проекта.
 */
export type AdDerived = {
  /** Клики ÷ показы. */
  ctr: number | null;
  /** Цена клика. */
  cpc: number | null;
  /** Цена тысячи показов. */
  cpm: number | null;
  /** Цена лида. */
  cpl: number | null;
  /** Показы ÷ охват: сколько раз в среднем человек увидел объявление. */
  frequency: number | null;
};

export type CampaignRow = AdCounters &
  AdDerived & {
    id: string;
    externalId: string;
    name: string;
    status: string | null;
    objective: string | null;
    purpose: CampaignPurpose;
    dailyBudget: number | null;
    lifetimeBudget: number | null;
    currency: string | null;
    syncedAt: string;
  };

export type AdsTotals = AdCounters &
  AdDerived & {
    /** Валюта кабинета, если она у всех кампаний одна. */
    sourceCurrency: string | null;
  };

export type AdsData = {
  campaigns: CampaignRow[];
  /** Итог по всем кампаниям — он же уходит в деньги проекта. */
  totals: AdsTotals;
  /** Отдельно курсы и отдельно наём: смешивать их цену лида нельзя. */
  byPurpose: Record<CampaignPurpose, AdsTotals>;
  lastSyncedAt: string | null;
};

const EMPTY_COUNTERS: AdCounters = {
  spend: 0,
  spendSource: 0,
  impressions: 0,
  reach: 0,
  clicks: 0,
  leads: 0,
};

function divide(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  const value = numerator / denominator;
  return Number.isFinite(value) ? value : null;
}

/**
 * Производные считаем на той сумме, в которой показываем: если кабинет
 * в долларах, цена клика тоже в долларах.
 */
function derive(counters: AdCounters, sourceCurrency: string | null): AdDerived {
  const money = sourceCurrency ? counters.spendSource : counters.spend;
  return {
    ctr: divide(counters.clicks, counters.impressions),
    cpc: divide(money, counters.clicks),
    cpm: divide(money * 1000, counters.impressions),
    cpl: divide(money, counters.leads),
    frequency: divide(counters.impressions, counters.reach),
  };
}

function addCounters(a: AdCounters, b: AdCounters): AdCounters {
  return {
    spend: a.spend + b.spend,
    spendSource: a.spendSource + b.spendSource,
    impressions: a.impressions + b.impressions,
    reach: a.reach + b.reach,
    clicks: a.clicks + b.clicks,
    leads: a.leads + b.leads,
  };
}

function totalsFrom(counters: AdCounters, sourceCurrency: string | null): AdsTotals {
  return { ...counters, ...derive(counters, sourceCurrency), sourceCurrency };
}

export async function loadAdsData(
  projectId: string,
  range: DateRange,
  platform: string,
): Promise<AdsData> {
  const supabase = await createSupabaseServerClient();

  const { data: campaigns } = await supabase
    .from("ad_campaigns")
    .select("*")
    .eq("project_id", projectId)
    .eq("platform", platform)
    .order("name", { ascending: true });

  const list = campaigns ?? [];
  if (list.length === 0) {
    const empty = totalsFrom(EMPTY_COUNTERS, null);
    return {
      campaigns: [],
      totals: empty,
      byPurpose: { courses: empty, vacancy: empty },
      lastSyncedAt: null,
    };
  }

  let insightsQuery = supabase
    .from("ad_insights_daily")
    .select("campaign_id, spend, spend_source, impressions, reach, clicks, leads, currency")
    .eq("project_id", projectId)
    .in(
      "campaign_id",
      list.map((campaign) => campaign.id),
    );

  if (range.from) insightsQuery = insightsQuery.gte("date", range.from);
  if (range.to) insightsQuery = insightsQuery.lte("date", range.to);

  const { data: insights } = await insightsQuery;

  const byCampaign = new Map<string, AdCounters>();
  for (const row of insights ?? []) {
    const current = byCampaign.get(row.campaign_id) ?? { ...EMPTY_COUNTERS };
    byCampaign.set(
      row.campaign_id,
      addCounters(current, {
        spend: Number(row.spend),
        spendSource: Number(row.spend_source),
        impressions: row.impressions,
        reach: row.reach,
        clicks: row.clicks,
        leads: row.leads,
      }),
    );
  }

  const currencies = new Set(list.map((campaign) => campaign.currency).filter(Boolean));
  const sourceCurrency = currencies.size === 1 ? ([...currencies][0] as string) : null;

  const rows: CampaignRow[] = list.map((campaign) => {
    const counters = byCampaign.get(campaign.id) ?? { ...EMPTY_COUNTERS };
    return {
      ...counters,
      ...derive(counters, sourceCurrency),
      id: campaign.id,
      externalId: campaign.external_id,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      purpose: campaignPurpose(campaign.name),
      dailyBudget: campaign.daily_budget === null ? null : Number(campaign.daily_budget),
      lifetimeBudget:
        campaign.lifetime_budget === null ? null : Number(campaign.lifetime_budget),
      currency: campaign.currency,
      syncedAt: campaign.synced_at,
    };
  });

  const sums: Record<CampaignPurpose, AdCounters> = {
    courses: { ...EMPTY_COUNTERS },
    vacancy: { ...EMPTY_COUNTERS },
  };
  let all: AdCounters = { ...EMPTY_COUNTERS };

  for (const row of rows) {
    sums[row.purpose] = addCounters(sums[row.purpose], row);
    all = addCounters(all, row);
  }

  return {
    campaigns: rows,
    totals: totalsFrom(all, sourceCurrency),
    byPurpose: {
      courses: totalsFrom(sums.courses, sourceCurrency),
      vacancy: totalsFrom(sums.vacancy, sourceCurrency),
    },
    lastSyncedAt: list.reduce<string | null>(
      (latest, campaign) =>
        !latest || campaign.synced_at > latest ? campaign.synced_at : latest,
      null,
    ),
  };
}
