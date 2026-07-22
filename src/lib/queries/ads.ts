import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/date-range";
import { campaignPurpose, type CampaignPurpose } from "@/lib/ads/purpose";

/** Данные раздела «Реклама» (ТЗ, Блок 3): кампании, группы и объявления. */

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
 * Считаем сами: у Meta они в валюте кабинета, а расход мы ещё и переводим
 * в валюту проекта — готовые значения разъехались бы с нашими.
 */
export type AdDerived = {
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpl: number | null;
  /** Показы ÷ охват: сколько раз в среднем человек увидел объявление. */
  frequency: number | null;
};

export type AdsTotals = AdCounters & AdDerived & { sourceCurrency: string | null };

/** Строка любого уровня: кампания, группа или объявление. */
export type AdRow = AdCounters &
  AdDerived & {
    id: string;
    name: string;
    status: string | null;
    purpose: CampaignPurpose;
    /** Чей это ребёнок — показываем родителя строкой ниже названия. */
    parentName: string | null;
    /** Куда ведёт трафик: WhatsApp, профиль Instagram, сайт. Только у групп. */
    destination: string | null;
    objective: string | null;
    dailyBudget: number | null;
    lifetimeBudget: number | null;
    previewUrl: string | null;
  };

export type AdsLevel = "campaigns" | "adsets" | "ads";

export type AdsData = {
  rows: AdRow[];
  /** Итог по всему кабинету за период. */
  totals: AdsTotals;
  /** Отдельно курсы и отдельно наём: смешивать их цену лида нельзя. */
  byPurpose: Record<CampaignPurpose, AdsTotals>;
  lastSyncedAt: string | null;
  /** Сколько строк спрятано фильтром «только с расходом». */
  hidden: number;
};

const EMPTY: AdCounters = {
  spend: 0,
  spendSource: 0,
  impressions: 0,
  reach: 0,
  clicks: 0,
  leads: 0,
};

function divide(a: number, b: number): number | null {
  if (!b) return null;
  const value = a / b;
  return Number.isFinite(value) ? value : null;
}

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

function add(a: AdCounters, b: AdCounters): AdCounters {
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

type InsightRow = {
  key: string;
  spend: number;
  spend_source: number;
  impressions: number;
  reach: number;
  clicks: number;
  leads: number;
};

function foldInsights(rows: InsightRow[]): Map<string, AdCounters> {
  const byKey = new Map<string, AdCounters>();
  for (const row of rows) {
    byKey.set(
      row.key,
      add(byKey.get(row.key) ?? { ...EMPTY }, {
        spend: Number(row.spend),
        spendSource: Number(row.spend_source),
        impressions: row.impressions,
        reach: row.reach,
        clicks: row.clicks,
        leads: row.leads,
      }),
    );
  }
  return byKey;
}

export async function loadAdsData(
  projectId: string,
  range: DateRange,
  level: AdsLevel,
  options: { onlySpending?: boolean } = {},
): Promise<AdsData> {
  const supabase = await createSupabaseServerClient();
  const onlySpending = options.onlySpending ?? true;

  const [campaignsResult, setsResult, creativesResult] = await Promise.all([
    supabase
      .from("ad_campaigns")
      .select("*")
      .eq("project_id", projectId)
      .eq("platform", "meta"),
    supabase.from("ad_sets").select("*").eq("project_id", projectId).eq("platform", "meta"),
    level === "ads"
      ? supabase
          .from("creatives")
          .select("id, name, status, preview_url, campaign_id, ad_set_id")
          .eq("project_id", projectId)
          .eq("platform", "meta")
          .not("external_id", "is", null)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const campaigns = campaignsResult.data ?? [];
  const sets = setsResult.data ?? [];
  const creatives = (creativesResult.data ?? []) as {
    id: string;
    name: string;
    status: string | null;
    preview_url: string | null;
    campaign_id: string | null;
    ad_set_id: string | null;
  }[];

  const currencies = new Set(campaigns.map((row) => row.currency).filter(Boolean));
  const sourceCurrency = currencies.size === 1 ? ([...currencies][0] as string) : null;

  const purposeByCampaign = new Map(
    campaigns.map((row) => [row.id, campaignPurpose(row.name)] as const),
  );
  const nameByCampaign = new Map(campaigns.map((row) => [row.id, row.name] as const));
  const nameBySet = new Map(sets.map((row) => [row.id, row.name] as const));

  /**
   * Группа наследует назначение кампании, но собственное название сильнее:
   * бывает, что кампания названа нейтрально, а «вакансия» стоит уже в группе.
   */
  const purposeBySet = new Map(
    sets.map((row) => {
      const own = campaignPurpose(row.name);
      const inherited = row.campaign_id
        ? (purposeByCampaign.get(row.campaign_id) ?? "courses")
        : "courses";
      return [row.id, own === "vacancy" || inherited === "vacancy" ? "vacancy" : "courses"] as const;
    }),
  );

  const dateFilter = <T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(
    query: T,
  ) => {
    let next = query;
    if (range.from) next = next.gte("date", range.from);
    if (range.to) next = next.lte("date", range.to);
    return next;
  };

  // Итог по проекту всегда считаем по кампаниям: складывать уровни нельзя,
  // расход удвоится.
  const campaignInsights = await dateFilter(
    supabase
      .from("ad_insights_daily")
      .select("campaign_id, spend, spend_source, impressions, reach, clicks, leads")
      .eq("project_id", projectId),
  );

  const byCampaign = foldInsights(
    (campaignInsights.data ?? []).map((row) => ({ ...row, key: row.campaign_id })),
  );

  let byRow = byCampaign;
  if (level === "adsets") {
    const setInsights = await dateFilter(
      supabase
        .from("ad_set_insights_daily")
        .select("ad_set_id, spend, spend_source, impressions, reach, clicks, leads")
        .eq("project_id", projectId),
    );
    byRow = foldInsights((setInsights.data ?? []).map((row) => ({ ...row, key: row.ad_set_id })));
  } else if (level === "ads") {
    const adInsights = await dateFilter(
      supabase
        .from("ad_creative_insights_daily")
        .select("creative_id, spend, spend_source, impressions, reach, clicks, leads")
        .eq("project_id", projectId),
    );
    byRow = foldInsights((adInsights.data ?? []).map((row) => ({ ...row, key: row.creative_id })));
  }

  const build = (): AdRow[] => {
    if (level === "campaigns") {
      return campaigns.map((row) => {
        const counters = byCampaign.get(row.id) ?? { ...EMPTY };
        return {
          ...counters,
          ...derive(counters, sourceCurrency),
          id: row.id,
          name: row.name,
          status: row.status,
          purpose: purposeByCampaign.get(row.id) ?? "courses",
          parentName: null,
          destination: null,
          objective: row.objective,
          dailyBudget: row.daily_budget === null ? null : Number(row.daily_budget),
          lifetimeBudget: row.lifetime_budget === null ? null : Number(row.lifetime_budget),
          previewUrl: null,
        };
      });
    }

    if (level === "adsets") {
      return sets.map((row) => {
        const counters = byRow.get(row.id) ?? { ...EMPTY };
        return {
          ...counters,
          ...derive(counters, sourceCurrency),
          id: row.id,
          name: row.name,
          status: row.status,
          purpose: purposeBySet.get(row.id) ?? "courses",
          parentName: row.campaign_id ? (nameByCampaign.get(row.campaign_id) ?? null) : null,
          destination: row.destination,
          objective: null,
          dailyBudget: row.daily_budget === null ? null : Number(row.daily_budget),
          lifetimeBudget: row.lifetime_budget === null ? null : Number(row.lifetime_budget),
          previewUrl: null,
        };
      });
    }

    return creatives.map((row) => {
      const counters = byRow.get(row.id) ?? { ...EMPTY };
      const purpose = row.ad_set_id
        ? (purposeBySet.get(row.ad_set_id) ?? "courses")
        : row.campaign_id
          ? (purposeByCampaign.get(row.campaign_id) ?? "courses")
          : "courses";
      return {
        ...counters,
        ...derive(counters, sourceCurrency),
        id: row.id,
        name: row.name,
        status: row.status,
        purpose,
        parentName: row.ad_set_id
          ? (nameBySet.get(row.ad_set_id) ?? null)
          : row.campaign_id
            ? (nameByCampaign.get(row.campaign_id) ?? null)
            : null,
        destination: null,
        objective: null,
        dailyBudget: null,
        lifetimeBudget: null,
        previewUrl: row.preview_url,
      };
    });
  };

  const all = build();
  // Кабинет копит сотни давно остановленных кампаний. Показываем те, что
  // тратили деньги в выбранном периоде, — остальные только шумят.
  const visible = onlySpending ? all.filter((row) => row.spendSource > 0 || row.spend > 0) : all;
  visible.sort((a, b) => b.spendSource - a.spendSource || b.spend - a.spend);

  const sums: Record<CampaignPurpose, AdCounters> = {
    courses: { ...EMPTY },
    vacancy: { ...EMPTY },
  };
  let overall: AdCounters = { ...EMPTY };

  for (const row of campaigns) {
    const counters = byCampaign.get(row.id);
    if (!counters) continue;
    const purpose = purposeByCampaign.get(row.id) ?? "courses";
    sums[purpose] = add(sums[purpose], counters);
    overall = add(overall, counters);
  }

  return {
    rows: visible,
    totals: totalsFrom(overall, sourceCurrency),
    byPurpose: {
      courses: totalsFrom(sums.courses, sourceCurrency),
      vacancy: totalsFrom(sums.vacancy, sourceCurrency),
    },
    lastSyncedAt: campaigns.reduce<string | null>(
      (latest, row) => (!latest || row.synced_at > latest ? row.synced_at : latest),
      null,
    ),
    hidden: all.length - visible.length,
  };
}
