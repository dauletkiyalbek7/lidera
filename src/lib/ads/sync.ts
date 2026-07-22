import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { addDays, today } from "@/lib/date-range";
import type { Database } from "@/lib/database.types";
import type { IntegrationCredentials } from "@/lib/queries/integrations";
import {
  fetchAccount,
  fetchAdDailyInsights,
  fetchAds,
  fetchAdSetDailyInsights,
  fetchAdSets,
  fetchCampaigns,
  fetchDailyInsights,
  MetaApiError,
} from "@/lib/ads/meta";

/**
 * Ядро синхронизации Meta Ads (ТЗ, Блок 3).
 *
 * Вынесено из серверного действия, потому что запускается из двух мест:
 * кнопкой на экране и по расписанию. Права проверяет вызывающий — здесь их
 * уже не проверить: у почасового запуска пользователя нет вовсе.
 */

export type AdsSyncResult = { error: string | null; message: string | null };

/** Глубина синхронизации: за раз тянем окно, а не всю историю кабинета. */
const SYNC_DAYS = 30;
const MAX_RATE = 100_000;

export type MetaSyncInput = {
  supabase: SupabaseClient<Database>;
  projectId: string;
  projectCurrency: string;
  adSpendRate: number;
  credentials: IntegrationCredentials;
  /** Кто запустил: id человека или null, если это расписание. */
  actorId: string | null;
};

export async function runMetaSync({
  supabase,
  projectId,
  projectCurrency,
  adSpendRate,
  credentials,
  actorId,
}: MetaSyncInput): Promise<AdsSyncResult> {
  if (!credentials.account) {
    return {
      error: "У подключения не указан ID рекламного кабинета. Впишите его в «Интеграциях».",
      message: null,
    };
  }

  const until = today();
  const since = addDays(until, -(SYNC_DAYS - 1));

  let account;
  let campaigns;
  let insights;
  let adSets;
  let adSetInsights;
  let ads;
  let adInsights;
  try {
    account = await fetchAccount(credentials.token, credentials.account);
    [campaigns, insights, adSets, adSetInsights, ads, adInsights] = await Promise.all([
      fetchCampaigns(credentials.token, credentials.account),
      fetchDailyInsights(credentials.token, credentials.account, since, until),
      fetchAdSets(credentials.token, credentials.account),
      fetchAdSetDailyInsights(credentials.token, credentials.account, since, until),
      fetchAds(credentials.token, credentials.account),
      fetchAdDailyInsights(credentials.token, credentials.account, since, until),
    ]);
  } catch (error) {
    const reason =
      error instanceof MetaApiError ? error.message : "Meta не ответила. Попробуйте позже.";
    return { error: reason, message: null };
  }

  // Валюта кабинета совпала с валютой проекта — пересчитывать нечего.
  const rate =
    account.currency === projectCurrency ? 1 : Math.min(adSpendRate || 1, MAX_RATE);

  if (campaigns.length > 0) {
    const { error } = await supabase.from("ad_campaigns").upsert(
      campaigns.map((campaign) => ({
        project_id: projectId,
        platform: "meta",
        external_id: campaign.externalId,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        daily_budget: campaign.dailyBudget,
        lifetime_budget: campaign.lifetimeBudget,
        currency: account.currency,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: "project_id,platform,external_id" },
    );

    if (error) {
      return { error: "Не удалось сохранить кампании.", message: null };
    }
  }

  // Статистика ссылается на кампании по внутреннему id, поэтому читаем их обратно.
  const { data: stored } = await supabase
    .from("ad_campaigns")
    .select("id, external_id")
    .eq("project_id", projectId)
    .eq("platform", "meta");

  const idByExternal = new Map((stored ?? []).map((row) => [row.external_id, row.id]));

  const rows = insights
    .filter((row) => idByExternal.has(row.campaignId))
    .map((row) => ({
      project_id: projectId,
      campaign_id: idByExternal.get(row.campaignId) as string,
      date: row.date,
      spend: row.spend * rate,
      spend_source: row.spend,
      currency: account.currency,
      impressions: row.impressions,
      reach: row.reach,
      clicks: row.clicks,
      leads: row.leads,
    }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("ad_insights_daily")
      .upsert(rows, { onConflict: "project_id,campaign_id,date" });

    if (error) {
      return { error: "Не удалось сохранить статистику кампаний.", message: null };
    }
  }

  // Группы объявлений: средний уровень, на нём же назначение трафика.
  const setIdByExternal = new Map<string, string>();
  if (adSets.length > 0) {
    const { error } = await supabase.from("ad_sets").upsert(
      adSets.map((set) => ({
        project_id: projectId,
        platform: "meta",
        external_id: set.externalId,
        campaign_id: set.campaignExternalId
          ? (idByExternal.get(set.campaignExternalId) ?? null)
          : null,
        name: set.name,
        status: set.status,
        destination: set.destination,
        daily_budget: set.dailyBudget,
        lifetime_budget: set.lifetimeBudget,
        currency: account.currency,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: "project_id,platform,external_id" },
    );

    if (error) {
      return { error: `Не удалось сохранить группы объявлений: ${error.message}`, message: null };
    }

    const { data: storedSets } = await supabase
      .from("ad_sets")
      .select("id, external_id")
      .eq("project_id", projectId)
      .eq("platform", "meta");

    for (const row of storedSets ?? []) setIdByExternal.set(row.external_id, row.id);
  }

  if (setIdByExternal.size > 0 && adSetInsights.length > 0) {
    const setRows = adSetInsights
      .filter((row) => setIdByExternal.has(row.adSetId))
      .map((row) => ({
        project_id: projectId,
        ad_set_id: setIdByExternal.get(row.adSetId) as string,
        date: row.date,
        spend: row.spend * rate,
        spend_source: row.spend,
        currency: account.currency,
        impressions: row.impressions,
        reach: row.reach,
        clicks: row.clicks,
        leads: row.leads,
      }));

    if (setRows.length > 0) {
      const { error } = await supabase
        .from("ad_set_insights_daily")
        .upsert(setRows, { onConflict: "project_id,ad_set_id,date" });

      if (error) {
        return {
          error: `Не удалось сохранить статистику групп: ${error.message}`,
          message: null,
        };
      }
    }
  }

  // Креативы: объявления кабинета и их дневная статистика — основа сквозной аналитики.
  let creativesSaved = 0;
  if (ads.length > 0) {
    const { error } = await supabase.from("creatives").upsert(
      ads.map((ad) => ({
        project_id: projectId,
        platform: "meta",
        external_id: ad.externalId,
        name: ad.name,
        status: ad.status,
        preview_url: ad.previewUrl,
        campaign_id: ad.campaignExternalId
          ? (idByExternal.get(ad.campaignExternalId) ?? null)
          : null,
        ad_set_id: ad.adSetExternalId
          ? (setIdByExternal.get(ad.adSetExternalId) ?? null)
          : null,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: "project_id,platform,external_id" },
    );

    if (error) {
      return { error: `Не удалось сохранить объявления: ${error.message}`, message: null };
    }
    creativesSaved = ads.length;
  }

  if (creativesSaved > 0 && adInsights.length > 0) {
    const { data: storedCreatives } = await supabase
      .from("creatives")
      .select("id, external_id")
      .eq("project_id", projectId)
      .eq("platform", "meta");

    const creativeByExternal = new Map(
      (storedCreatives ?? []).map((row) => [row.external_id, row.id]),
    );

    const creativeRows = adInsights
      .filter((row) => creativeByExternal.has(row.adId))
      .map((row) => ({
        project_id: projectId,
        creative_id: creativeByExternal.get(row.adId) as string,
        date: row.date,
        spend: row.spend * rate,
        spend_source: row.spend,
        currency: account.currency,
        impressions: row.impressions,
        reach: row.reach,
        clicks: row.clicks,
        leads: row.leads,
      }));

    if (creativeRows.length > 0) {
      const { error } = await supabase
        .from("ad_creative_insights_daily")
        .upsert(creativeRows, { onConflict: "project_id,creative_id,date" });

      if (error) {
        return {
          error: `Не удалось сохранить статистику объявлений: ${error.message}`,
          message: null,
        };
      }
    }
  }

  // Расход дня в metrics_daily — сумма по всем кампаниям этого дня.
  // Берём именно уровень кампаний: сложить ещё и объявления значило бы удвоить расход.
  // Лиды туда не пишем: там живут лиды CRM, и смешивать их с рекламными нельзя.
  const spendByDate = new Map<string, number>();
  for (const row of rows) {
    spendByDate.set(row.date, (spendByDate.get(row.date) ?? 0) + row.spend);
  }

  let daysUpdated = 0;
  if (spendByDate.size > 0) {
    // Ключи у всех строк обязаны совпадать: PostgREST отвергает пачку,
    // где у одной записи есть поле, а у другой нет. Раньше сюда для уже
    // существующих дней подставлялся id — и в день с новой датой вся
    // запись расхода падала целиком.
    //
    // id не нужен: ON CONFLICT обновляет только переданные колонки,
    // остальные (лиды, продажи, выручка) остаются нетронутыми.
    const metricsRows = [...spendByDate.entries()].map(([date, spend]) => ({
      project_id: projectId,
      date,
      ad_spend: spend,
    }));

    const { error } = await supabase
      .from("metrics_daily")
      .upsert(metricsRows, { onConflict: "project_id,date" });

    if (error) {
      return { error: `Не удалось записать расход по дням: ${error.message}`, message: null };
    }
    daysUpdated = metricsRows.length;
  }

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: actorId,
    action: "ads.synced",
    details: {
      platform: "meta",
      campaigns: campaigns.length,
      creatives: creativesSaved,
      days: daysUpdated,
      currency: account.currency,
      rate,
    },
  });

  const rateNote =
    rate === 1 ? "" : ` Расход пересчитан по курсу ${rate} за 1 ${account.currency}.`;

  return {
    error: null,
    message:
      `Кабинет «${account.name}»: кампаний ${campaigns.length}, ` +
      `групп ${adSets.length}, объявлений ${creativesSaved}, ` +
      `дней статистики ${daysUpdated}.${rateNote}`,
  };
}
