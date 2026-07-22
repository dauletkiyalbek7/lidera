import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/queries/employees";
import { decryptSecret, hasSecretsKey } from "@/lib/crypto";

/** Состояние подключений проекта (ТЗ, Блок 4). Секреты сюда не попадают — только подсказки. */

export type IntegrationState = {
  id: string;
  provider: string;
  status: string;
  /** Несекретный идентификатор кабинета: ID рекламного аккаунта, имя бота. */
  account: string | null;
  /** «…yZ4k» — последние символы ключа, чтобы человек узнал свой токен. */
  hint: string | null;
  secretUpdatedAt: string | null;
  createdAt: string;
};

function readAccount(config: unknown): string | null {
  if (!config || typeof config !== "object") return null;
  const value = (config as Record<string, unknown>).account;
  return typeof value === "string" && value ? value : null;
}

export async function loadIntegrations(projectId: string): Promise<IntegrationState[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("integrations")
    .select("id, provider, status, config, created_at")
    .eq("project_id", projectId);

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    provider: row.provider,
    status: row.status,
    account: readAccount(row.config),
    hint: null as string | null,
    secretUpdatedAt: null as string | null,
    createdAt: row.created_at,
  }));

  // Подсказки лежат в таблице, закрытой RLS наглухо: её читает только сервисный ключ.
  if (rows.length === 0 || !hasServiceRoleKey()) return rows;

  const admin = createSupabaseAdminClient();
  const { data: secrets } = await admin
    .from("integration_secrets")
    .select("integration_id, hint, updated_at")
    .eq("project_id", projectId);

  const byIntegration = new Map(
    (secrets ?? []).map((row) => [row.integration_id, row]),
  );

  return rows.map((row) => {
    const secret = byIntegration.get(row.id);
    return {
      ...row,
      hint: secret?.hint ?? null,
      secretUpdatedAt: secret?.updated_at ?? null,
    };
  });
}

export type IntegrationCredentials = {
  integrationId: string;
  /** Расшифрованный токен. Наружу его отдавать нельзя — только в серверный вызов API. */
  token: string;
  account: string | null;
};

/**
 * Достаёт и расшифровывает ключ интеграции.
 * Вызывать только из серверного кода, который сам проверил права пользователя:
 * функция ходит сервисным ключом и обходит RLS.
 */
export async function readIntegrationCredentials(
  projectId: string,
  provider: string,
): Promise<IntegrationCredentials | null> {
  if (!hasServiceRoleKey() || !hasSecretsKey()) return null;

  const supabase = await createSupabaseServerClient();
  const { data: integration } = await supabase
    .from("integrations")
    .select("id, status, config")
    .eq("project_id", projectId)
    .eq("provider", provider)
    .maybeSingle();

  if (!integration || integration.status !== "connected") return null;

  const admin = createSupabaseAdminClient();
  const { data: secret } = await admin
    .from("integration_secrets")
    .select("ciphertext, iv, auth_tag")
    .eq("integration_id", integration.id)
    .maybeSingle();

  if (!secret) return null;

  try {
    return {
      integrationId: integration.id,
      token: decryptSecret({
        ciphertext: secret.ciphertext,
        iv: secret.iv,
        authTag: secret.auth_tag,
      }),
      account: readAccount(integration.config),
    };
  } catch {
    // Ключ шифрования сменили — расшифровать нечем, подключение надо повторить.
    return null;
  }
}

/**
 * То же самое, но для запросов без пользователя — вебхуков.
 * Сессии там нет вовсе, поэтому и строку подключения читаем сервисным ключом.
 * Вызывать можно только с project_id, полученным по проверенному секрету вебхука.
 */
export async function readIntegrationCredentialsAsPlatform(
  projectId: string,
  provider: string,
): Promise<IntegrationCredentials | null> {
  if (!hasServiceRoleKey() || !hasSecretsKey()) return null;

  const admin = createSupabaseAdminClient();
  const { data: integration } = await admin
    .from("integrations")
    .select("id, status, config")
    .eq("project_id", projectId)
    .eq("provider", provider)
    .maybeSingle();

  if (!integration || integration.status !== "connected") return null;

  const { data: secret } = await admin
    .from("integration_secrets")
    .select("ciphertext, iv, auth_tag")
    .eq("integration_id", integration.id)
    .maybeSingle();

  if (!secret) return null;

  try {
    return {
      integrationId: integration.id,
      token: decryptSecret({
        ciphertext: secret.ciphertext,
        iv: secret.iv,
        authTag: secret.auth_tag,
      }),
      account: readAccount(integration.config),
    };
  } catch {
    return null;
  }
}
