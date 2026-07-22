"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readIntegrationCredentials } from "@/lib/queries/integrations";
import { runMetaSync, type AdsSyncResult } from "@/lib/ads/sync";

export type AdsSyncState = AdsSyncResult;

const MAX_RATE = 100_000;

function mayManageAds(role: string, canManage: boolean): boolean {
  return canManage || role === "director";
}

/**
 * Синхронизация Meta Ads кнопкой на экране (ТЗ, Блок 3).
 * Сама работа — в runMetaSync: то же самое делает почасовое расписание.
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
