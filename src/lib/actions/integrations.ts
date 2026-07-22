"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { encryptSecret, hasSecretsKey, secretHint } from "@/lib/crypto";
import { getIntegrationProvider } from "@/lib/integrations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasServiceRoleKey } from "@/lib/queries/employees";

export type IntegrationFormState = { error: string | null; saved: boolean };

const MAX_ACCOUNT_LENGTH = 120;

/** Подключения ведёт владелец или директор проекта (ТЗ, Блок 4). */
function mayManageIntegrations(role: string, canManage: boolean): boolean {
  return canManage || role === "director";
}

/**
 * Подключение внешнего сервиса.
 * Секрет шифруется на сервере и уходит в таблицу, закрытую RLS наглухо:
 * ни один клиентский запрос её не прочитает (ТЗ, раздел 3, пункт 6).
 */
export async function connectIntegration(
  _prevState: IntegrationFormState,
  formData: FormData,
): Promise<IntegrationFormState> {
  const projectId = String(formData.get("project_id") ?? "");
  const { role, canManage, user } = await requireProjectContext(projectId);

  if (!mayManageIntegrations(role, canManage)) {
    return { error: "Подключать сервисы может владелец или директор проекта.", saved: false };
  }

  const provider = getIntegrationProvider(String(formData.get("provider") ?? ""));
  if (!provider) {
    return { error: "Неизвестный сервис.", saved: false };
  }

  if (!hasSecretsKey()) {
    return {
      error: "На сервере не задан LIDERA_SECRETS_KEY — шифровать ключ нечем.",
      saved: false,
    };
  }
  if (!hasServiceRoleKey()) {
    return {
      error: "На сервере не задан SUPABASE_SERVICE_ROLE_KEY — сохранить секрет некуда.",
      saved: false,
    };
  }

  const secret = String(formData.get("secret") ?? "").trim();
  if (secret.length < 8) {
    return { error: `Укажите ${provider.secretLabel.toLowerCase()} целиком.`, saved: false };
  }

  const account = String(formData.get("account") ?? "")
    .trim()
    .slice(0, MAX_ACCOUNT_LENGTH);

  const supabase = await createSupabaseServerClient();

  // В обычной таблице лежит только то, что не жалко показать: статус и ID кабинета.
  const { data: integration, error } = await supabase
    .from("integrations")
    .upsert(
      {
        project_id: projectId,
        provider: provider.key,
        status: "connected",
        config: account ? { account } : {},
      },
      { onConflict: "project_id,provider" },
    )
    .select("id")
    .single();

  if (error || !integration) {
    return { error: "Не удалось сохранить подключение. Попробуйте ещё раз.", saved: false };
  }

  const encrypted = encryptSecret(secret);
  const admin = createSupabaseAdminClient();
  const { error: secretError } = await admin.from("integration_secrets").upsert(
    {
      integration_id: integration.id,
      project_id: projectId,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag,
      hint: secretHint(secret),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "integration_id" },
  );

  if (secretError) {
    // Ключ не лёг — подключение не считается рабочим, откатываем статус.
    await supabase
      .from("integrations")
      .update({ status: "disconnected" })
      .eq("id", integration.id);
    return { error: "Не удалось сохранить ключ. Попробуйте ещё раз.", saved: false };
  }

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "integration.connected",
    details: { provider: provider.key },
  });

  revalidatePath(`/p/${projectId}/integrations`);
  return { error: null, saved: true };
}

/** Отключение сервиса: строка подключения остаётся, ключ стирается насовсем. */
export async function disconnectIntegration(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const providerKey = String(formData.get("provider") ?? "");

  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!mayManageIntegrations(role, canManage)) return;
  if (!getIntegrationProvider(providerKey)) return;

  const supabase = await createSupabaseServerClient();
  const { data: integration } = await supabase
    .from("integrations")
    .select("id")
    .eq("project_id", projectId)
    .eq("provider", providerKey)
    .maybeSingle();

  if (!integration) return;

  if (hasServiceRoleKey()) {
    const admin = createSupabaseAdminClient();
    await admin.from("integration_secrets").delete().eq("integration_id", integration.id);
  }

  await supabase
    .from("integrations")
    .update({ status: "disconnected", config: {} })
    .eq("id", integration.id);

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "integration.disconnected",
    details: { provider: providerKey },
  });

  revalidatePath(`/p/${projectId}/integrations`);
}
