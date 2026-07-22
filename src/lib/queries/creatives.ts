import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createdAtBounds, type DateRange } from "@/lib/date-range";
import { campaignPurpose, type CampaignPurpose } from "@/lib/ads/purpose";
import {
  derivePerformance,
  EMPTY_AD_STATS,
  EMPTY_CRM_STATS,
  type CreativeAdStats,
  type CreativeCrmStats,
  type CreativePerformance,
} from "@/lib/ads/attribution";

/** Данные раздела «Аналитика креативов» (ТЗ, Блок 3). */

export type CreativeMediaType = "video" | "image" | null;

export type CreativeRow = CreativePerformance & {
  id: string;
  name: string;
  platform: string | null;
  status: string | null;
  /** Ссылка на предпросмотр в Meta — открывается по клику. */
  previewUrl: string | null;
  /** Картинка объявления; у видео — кадр из ролика. */
  thumbnailUrl: string | null;
  mediaType: CreativeMediaType;
  campaignName: string | null;
  adSetName: string | null;
  /** Курс или наём: смешивать их цену лида нельзя. */
  purpose: CampaignPurpose;
};

export type CreativesData = {
  rows: CreativeRow[];
  /** Сколько лидов CRM за период вообще привязано к креативу. */
  attributedLeads: number;
  totalLeads: number;
  /** Итоги по показанным строкам. */
  totals: CreativePerformance;
  /** Валюта рекламного кабинета: суммы по рекламе показываем в ней. */
  sourceCurrency: string | null;
  /** Сколько строк спрятал фильтр «только с расходом». */
  hidden: number;
};

export type CreativesOptions = {
  /** Кабинет копит тысячи старых объявлений — по умолчанию прячем спящие. */
  onlyActive?: boolean;
  purpose?: CampaignPurpose | "all";
};

export async function loadCreativesAnalytics(
  projectId: string,
  range: DateRange,
  options: CreativesOptions = {},
): Promise<CreativesData> {
  const supabase = await createSupabaseServerClient();
  const { since, until } = createdAtBounds(range);
  const onlyActive = options.onlyActive ?? true;
  const purposeFilter = options.purpose ?? "all";

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

  const [creativesResult, campaignsResult, setsResult, leadsResult, salesResult, insightsResult] =
    await Promise.all([
      supabase
        .from("creatives")
        .select(
          "id, name, platform, status, preview_url, thumbnail_url, media_type, campaign_id, ad_set_id",
        )
        .eq("project_id", projectId),
      supabase.from("ad_campaigns").select("id, name, currency").eq("project_id", projectId),
      supabase.from("ad_sets").select("id, name, campaign_id").eq("project_id", projectId),
      leadsQuery,
      salesQuery,
      insightsQuery,
    ]);

  const campaigns = campaignsResult.data ?? [];
  const sets = setsResult.data ?? [];

  const campaignById = new Map(campaigns.map((row) => [row.id, row] as const));
  const setById = new Map(sets.map((row) => [row.id, row] as const));

  const currencies = new Set(campaigns.map((row) => row.currency).filter(Boolean));
  const sourceCurrency = currencies.size === 1 ? ([...currencies][0] as string) : null;

  const purposeByCampaign = new Map(
    campaigns.map((row) => [row.id, campaignPurpose(row.name)] as const),
  );

  /** Как и в разделе «Реклама»: собственное имя группы сильнее имени кампании. */
  const purposeBySet = new Map(
    sets.map((row) => {
      const own = campaignPurpose(row.name);
      const inherited = row.campaign_id
        ? (purposeByCampaign.get(row.campaign_id) ?? "courses")
        : "courses";
      return [row.id, own === "vacancy" || inherited === "vacancy" ? "vacancy" : "courses"] as const;
    }),
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

  const all: CreativeRow[] = (creativesResult.data ?? []).map((creative) => {
    const ads = adStats.get(creative.id) ?? EMPTY_AD_STATS;
    const crm = crmStats.get(creative.id) ?? EMPTY_CRM_STATS;

    const purpose: CampaignPurpose = creative.ad_set_id
      ? (purposeBySet.get(creative.ad_set_id) ?? "courses")
      : creative.campaign_id
        ? (purposeByCampaign.get(creative.campaign_id) ?? "courses")
        : "courses";

    return {
      id: creative.id,
      name: creative.name,
      platform: creative.platform,
      status: creative.status,
      previewUrl: creative.preview_url,
      thumbnailUrl: creative.thumbnail_url,
      mediaType: (creative.media_type as CreativeMediaType) ?? null,
      campaignName: creative.campaign_id
        ? (campaignById.get(creative.campaign_id)?.name ?? null)
        : null,
      adSetName: creative.ad_set_id ? (setById.get(creative.ad_set_id)?.name ?? null) : null,
      purpose,
      ...derivePerformance(ads, crm),
    };
  });

  const byPurpose =
    purposeFilter === "all" ? all : all.filter((row) => row.purpose === purposeFilter);

  // Показываем то, что жило в выбранном периоде: тратило деньги или принесло
  // заявку. Остальное — тысячи спящих объявлений, они только мешают смотреть.
  const visible = onlyActive
    ? byPurpose.filter((row) => row.spendSource > 0 || row.spend > 0 || row.leads > 0)
    : byPurpose;

  // Сначала то, что приносит деньги; при равенстве — по расходу.
  visible.sort(
    (a, b) => b.revenue - a.revenue || b.sales - a.sales || b.spendSource - a.spendSource,
  );

  const totalAds = visible.reduce<CreativeAdStats>(
    (sum, row) => ({
      spend: sum.spend + row.spend,
      spendSource: sum.spendSource + row.spendSource,
      impressions: sum.impressions + row.impressions,
      clicks: sum.clicks + row.clicks,
      platformLeads: sum.platformLeads + row.platformLeads,
    }),
    { ...EMPTY_AD_STATS },
  );

  const totalCrm = visible.reduce<CreativeCrmStats>(
    (sum, row) => ({
      leads: sum.leads + row.leads,
      qualified: sum.qualified + row.qualified,
      sales: sum.sales + row.sales,
      revenue: sum.revenue + row.revenue,
    }),
    { ...EMPTY_CRM_STATS },
  );

  return {
    rows: visible,
    attributedLeads,
    totalLeads,
    totals: derivePerformance(totalAds, totalCrm),
    sourceCurrency,
    hidden: byPurpose.length - visible.length,
  };
}
