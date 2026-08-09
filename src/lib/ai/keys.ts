import "server-only";

import { readIntegrationCredentialsAsPlatform } from "@/lib/queries/integrations";

/**
 * Откуда берём ключи AI (ТЗ, Блок 4).
 *
 * Модель, о которой договорились: ключ может быть либо проекта (он подключил свой
 * OpenAI/DeepSeek и сам пополняет баланс), либо наш платформенный из переменных
 * окружения (работаем на своём аккаунте). Приоритет — у ключа проекта.
 *
 * Ключи живут только на сервере: проектные — зашифрованы в integration_secrets,
 * платформенные — в env. В браузер не уходят.
 */

export type AiKeys = {
  openai: string | null;
  deepseek: string | null;
};

async function projectKey(projectId: string, provider: string): Promise<string | null> {
  const creds = await readIntegrationCredentialsAsPlatform(projectId, provider);
  return creds?.token ?? null;
}

export async function resolveAiKeys(projectId: string): Promise<AiKeys> {
  const [openaiProject, deepseekProject] = await Promise.all([
    projectKey(projectId, "openai"),
    projectKey(projectId, "deepseek"),
  ]);

  return {
    openai: openaiProject ?? process.env.OPENAI_API_KEY ?? null,
    deepseek: deepseekProject ?? process.env.DEEPSEEK_API_KEY ?? null,
  };
}
