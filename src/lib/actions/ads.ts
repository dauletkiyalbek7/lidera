"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readIntegrationCredentials } from "@/lib/queries/integrations";
import { addDays, today } from "@/lib/date-range";
import {
  fetchAccount,
  fetchAdDailyInsights,
  fetchAds,
  fetchCampaigns,
  fetchDailyInsights,
  MetaApiError,
} from "@/lib/ads/meta";

export type AdsSyncState = { error: string | null; message: string | null };

/** Глубина синхронизации: за раз тянем окно, а не всю историю кабинета. */
const SYNC_DAYS = 30;
const MAX_RATE = 100_000;

function mayManageAds(role: string, canManage: boolean): boolean {
  return canManage || role === "director";
}

/**
 * Синхронизация Meta Ads (ТЗ, Блок 3).
 * Кампании и дневная статистика ложатся в свои таблицы, а расход по дням —
 * в metrics_daily, откуда его читают Главная и все денежные разделы.
 */
export async function syncMetaAds(
  _prevState: AdsSyncState,
  formData: FormData,
): Promise<AdsSyncState> {
  const projectId = String(formData.get("project_id") ?? "");
  const { project, role, canManage, user } = await requireProjectContext(projectId);

  if (!mayManageAds(role, canManage)) {
    return { error: "Синхронизацию запускает владелец или директор проекта.", message: null };
  }

  const credentials = await readIntegrationCredentials(projectId, "meta");
  if (!credentials) {
    return {
      error: "Meta Ads не подключена. Добавьте токен в разделе «Интеграции».",
      message: null,
    };
  }
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
  let ads;
  let adInsights;
  try {
    account = await fetchAccount(credentials.token, credentials.account);
    [campaigns, insights, ads, adInsights] = await Promise.all([
      fetchCampaigns(credentials.token, credentials.account),
      fetchDailyInsights(credentials.token, credentials.account, since, until),
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
    account.currency === project.currency
      ? 1
      : Math.min(Number(project.ad_spend_rate) || 1, MAX_RATE);

  const supabase = await createSupabaseServerClient();

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
        synced_at: new Date().toISOString(),
      })),
      { onConflict: "project_id,platform,external_id" },
    );

    if (!error) creativesSaved = ads.length;
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
      await supabase
        .from("ad_creative_insights_daily")
        .upsert(creativeRows, { onConflict: "project_id,creative_id,date" });
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
    const dates = [...spendByDate.keys()];
    const { data: existing } = await supabase
      .from("metrics_daily")
      .select("id, date")
      .eq("project_id", projectId)
      .in("date", dates);

    const idByDate = new Map((existing ?? []).map((row) => [row.date, row.id]));

    const metricsRows = dates.map((date) => ({
      ...(idByDate.has(date) ? { id: idByDate.get(date) as string } : {}),
      project_id: projectId,
      date,
      ad_spend: spendByDate.get(date) ?? 0,
    }));

    const { error } = await supabase
      .from("metrics_daily")
      .upsert(metricsRows, { onConflict: "project_id,date" });

    if (!error) daysUpdated = metricsRows.length;
  }

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
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

  revalidatePath(`/p/${projectId}/ads`);
  revalidatePath(`/p/${projectId}/creatives-analytics`);
  revalidatePath(`/p/${projectId}`);

  const rateNote =
    rate === 1 ? "" : ` Расход пересчитан по курсу ${rate} за 1 ${account.currency}.`;

  return {
    error: null,
    message:
      `Кабинет «${account.name}»: кампаний ${campaigns.length}, ` +
      `креативов ${creativesSaved}, дней статистики ${daysUpdated}.${rateNote}`,
  };
}

/** Курс пересчёта валюты кабинета в валюту проекта (ТЗ: настройка проекта). */
export async function setAdSpendRate(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!mayManageAds(role, canManage)) return;

  const rate = Number(String(formData.get("rate") ?? "").replace(",", "."));
  if (!Number.isFinite(rate) || rate <= 0 || rate > MAX_RATE) return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("projects")
    .update({ ad_spend_rate: rate })
    .eq("id", projectId);

  if (error) return;

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "project.ad_rate_changed",
    details: { rate },
  });

  revalidatePath(`/p/${projectId}/ads`);
}
