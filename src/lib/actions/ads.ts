"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext, requireSectionAccess } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readIntegrationCredentials } from "@/lib/queries/integrations";
import { runMetaSync, type AdsSyncResult } from "@/lib/ads/sync";
import { loadCreativeInsightFromMeta, type CreativeInsight } from "@/lib/ads/creative-insight";

export type AdsSyncState = AdsSyncResult;

const MAX_RATE = 100_000;

function mayManageAds(role: string, canManage: boolean): boolean {
  return canManage || role === "director";
}

/**
 * Детали креатива для панели: ссылка на видео и метрики удержания из Meta.
 * Тянем по запросу при открытии панели — в списке это не нужно и дорого.
 */
export async function fetchCreativeInsight(
  projectId: string,
  creativeId: string,
): Promise<CreativeInsight | null> {
  await requireSectionAccess(projectId, "creatives-analytics");

  const supabase = await createSupabaseServerClient();
  const { data: creative } = await supabase
    .from("creatives")
    .select("external_id")
    .eq("project_id", projectId)
    .eq("id", creativeId)
    .maybeSingle();

  if (!creative?.external_id) return null;
  return loadCreativeInsightFromMeta(projectId, creative.external_id);
}

/**
 * Синхронизация Meta Ads кнопкой на экране (ТЗ, Блок 3).
 * Сама работа — в runMetaSync: то же самое делает почасовое расписание.
 */
/** Длина метки с запасом: это короткий слаг для utm_content, не текст. */
const MAX_UTM_LABEL = 120;

/**
 * UTM-метка креатива: владелец задаёт её сам и ставит в ссылку объявления как
 * utm_content. По ней intake находит именно этот креатив (см. /api/intake).
 * Пустое значение снимает метку. Уникальность в проекте гарантирует индекс БД.
 */
export async function setCreativeUtmLabel(
  projectId: string,
  creativeId: string,
  rawLabel: string,
): Promise<{ error: string | null }> {
  const { role, canManage } = await requireProjectContext(projectId);
  if (!mayManageAds(role, canManage)) {
    return { error: "Метку задаёт владелец или директор проекта." };
  }

  const label = rawLabel.trim().slice(0, MAX_UTM_LABEL);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("creatives")
    .update({ utm_label: label || null })
    .eq("project_id", projectId)
    .eq("id", creativeId);

  if (error) {
    if (error.code === "23505") {
      return { error: "Такая метка уже занята другим креативом." };
    }
    return { error: "Не удалось сохранить метку." };
  }

  revalidatePath(`/p/${projectId}/creatives-analytics`);
  return { error: null };
}

export type CreateCreativeState = { message: string | null; error: string | null };

/** Площадки, которые понимает воронка; иначе — без площадки. */
const KNOWN_PLATFORMS = new Set(["meta", "tiktok"]);

/**
 * Ручное заведение креатива (ТЗ, Блок 3).
 * Нужно, когда рекламу ведём до синка с Meta или вообще мимо него (WhatsApp,
 * оффлайн): владелец заранее заводит креатив с UTM-меткой, ставит метку в
 * ссылку/текст объявления — и вся привязка «креатив → лид → чек» работает, не
 * дожидаясь синхронизации. external_id нет — синк такие строки не трогает.
 */
export async function createCreative(
  _prev: CreateCreativeState,
  formData: FormData,
): Promise<CreateCreativeState> {
  const projectId = String(formData.get("project_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const rawPlatform = String(formData.get("platform") ?? "").trim().toLowerCase();
  const label = String(formData.get("utm_label") ?? "").trim().slice(0, MAX_UTM_LABEL);

  const { role, canManage } = await requireProjectContext(projectId);
  if (!mayManageAds(role, canManage)) {
    return { message: null, error: "Заводить креативы может владелец или директор." };
  }
  if (!name) {
    return { message: null, error: "Укажите название креатива." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("creatives").insert({
    project_id: projectId,
    name,
    platform: KNOWN_PLATFORMS.has(rawPlatform) ? rawPlatform : null,
    utm_label: label || null,
  });

  if (error) {
    if (error.code === "23505") {
      return { message: null, error: "Такая UTM-метка уже занята другим креативом." };
    }
    return { message: null, error: "Не удалось создать креатив." };
  }

  revalidatePath(`/p/${projectId}/creatives-analytics`);
  return { message: "Креатив создан.", error: null };
}

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

  const result = await runMetaSync({
    supabase: await createSupabaseServerClient(),
    projectId,
    projectCurrency: project.currency,
    adSpendRate: Number(project.ad_spend_rate),
    credentials,
    actorId: user.id,
  });

  if (!result.error) {
    revalidatePath(`/p/${projectId}/ads`);
    revalidatePath(`/p/${projectId}/creatives-analytics`);
    revalidatePath(`/p/${projectId}/marketing-dashboard`);
    revalidatePath(`/p/${projectId}`);
  }

  return result;
}

/** Курс пересчёта валюты кабинета в валюту проекта (ТЗ: настройка проекта). */
export async function setAdSpendRate(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!mayManageAds(role, canManage)) return;

  const raw = Number(String(formData.get("rate") ?? "").replace(",", "."));
  if (!Number.isFinite(raw) || raw <= 0) return;
  const rate = Math.min(raw, MAX_RATE);

  const supabase = await createSupabaseServerClient();
  await supabase.from("projects").update({ ad_spend_rate: rate }).eq("id", projectId);

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "ads.rate_changed",
    details: { rate },
  });

  revalidatePath(`/p/${projectId}/ads`);
}

/** Предел допустимой цены лида по креативу дороже которой — «выключить». */
const MAX_CPL_LIMIT = 100_000;

export async function setCplLimit(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!mayManageAds(role, canManage)) return;

  const raw = Number(String(formData.get("limit") ?? "").replace(",", "."));
  if (!Number.isFinite(raw) || raw <= 0) return;
  const limit = Math.min(raw, MAX_CPL_LIMIT);

  const supabase = await createSupabaseServerClient();
  await supabase.from("projects").update({ cpl_limit: limit }).eq("id", projectId);

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "ads.cpl_limit_changed",
    details: { limit },
  });

  revalidatePath(`/p/${projectId}/creatives-analytics`);
}
