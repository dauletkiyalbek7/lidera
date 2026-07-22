"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  generateLinkCode,
  generateTelegramToken,
  hashTelegramToken,
  telegramHint,
} from "@/lib/telegram";
import { hasServiceRoleKey } from "@/lib/queries/employees";

export type TelegramTokenState = {
  error: string | null;
  /** Показывается ровно один раз: в базе лежит только отпечаток. */
  token: string | null;
};

const SETTINGS_PATH = (projectId: string) => `/p/${projectId}/settings/telegram`;

/** Выпуск секрета вебхука. Повторный выпуск отзывает прежний. */
export async function issueTelegramToken(
  _prevState: TelegramTokenState,
  formData: FormData,
): Promise<TelegramTokenState> {
  const projectId = String(formData.get("project_id") ?? "");
  const { role, canManage, user } = await requireProjectContext(projectId);

  if (!(canManage || role === "director")) {
    return { error: "Секрет выпускает владелец или директор проекта.", token: null };
  }
  if (!hasServiceRoleKey()) {
    return { error: "На сервере не задан SUPABASE_SERVICE_ROLE_KEY.", token: null };
  }

  const token = generateTelegramToken();
  const admin = createSupabaseAdminClient();

  const { error } = await admin.from("telegram_webhooks").upsert(
    {
      project_id: projectId,
      token_hash: hashTelegramToken(token),
      hint: telegramHint(token),
      received_count: 0,
      issued_by: user.id,
      issued_at: new Date().toISOString(),
    },
    { onConflict: "project_id" },
  );

  if (error) {
    return { error: "Не удалось выпустить секрет. Попробуйте ещё раз.", token: null };
  }

  const supabase = await createSupabaseServerClient();
  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "telegram.token_issued",
    details: { hint: telegramHint(token) },
  });

  revalidatePath(SETTINGS_PATH(projectId));
  return { error: null, token };
}

/**
 * Выдать сотруднику код привязки.
 * Повторная выдача сбрасывает прежнюю привязку: код одноразовый,
 * и человек с чужим старым кодом не должен остаться подключённым.
 */
export async function issueLinkCode(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return;

  const { role, canManage } = await requireProjectContext(projectId);
  if (!(canManage || role === "director")) return;

  const supabase = await createSupabaseServerClient();
  await supabase.from("telegram_accounts").upsert(
    {
      project_id: projectId,
      user_id: userId,
      code: generateLinkCode(),
      code_issued_at: new Date().toISOString(),
      chat_id: null,
      username: null,
      status: "pending",
      linked_at: null,
    },
    { onConflict: "project_id,user_id" },
  );

  revalidatePath(SETTINGS_PATH(projectId));
}

/** Отключить сотрудника от бота: строка уходит целиком вместе с chat_id. */
export async function unlinkTelegram(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  if (!userId) return;

  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!(canManage || role === "director")) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("telegram_accounts")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "telegram.unlinked",
    details: { user_id: userId },
  });

  revalidatePath(SETTINGS_PATH(projectId));
}
