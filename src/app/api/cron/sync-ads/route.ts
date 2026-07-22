import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readIntegrationCredentialsAsPlatform } from "@/lib/queries/integrations";
import { runMetaSync } from "@/lib/ads/sync";
import { hasServiceRoleKey } from "@/lib/queries/employees";

/**
 * Почасовая синхронизация рекламы (ТЗ, Блок 3).
 * Дёргается расписанием Vercel — пользователя за этим запросом нет, поэтому
 * пишем сервисным ключом, а вместо сессии проверяем секрет CRON_SECRET.
 *
 * Обходим все проекты с подключённой Meta: расписание одно на платформу.
 */

/** Синхронизация ходит в Meta и ждёт ответа — минуты по умолчанию мало. */
export const maxDuration = 300;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Vercel присылает свой заголовок; сверх него принимаем Bearer — чтобы
 * расписание можно было проверить обычным curl.
 */
function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!hasServiceRoleKey()) {
    return json(503, { error: "Расписание не настроено на сервере." });
  }
  if (!authorized(request)) {
    return json(401, { error: "Неверный секрет расписания." });
  }

  const admin = createSupabaseAdminClient();

  const { data: connections } = await admin
    .from("integrations")
    .select("project_id")
    .eq("provider", "meta")
    .eq("status", "connected");

  const projectIds = [...new Set((connections ?? []).map((row) => row.project_id))];
  if (projectIds.length === 0) {
    return json(200, { ok: true, projects: 0, results: [] });
  }

  const { data: projects } = await admin
    .from("projects")
    .select("id, name, currency, ad_spend_rate")
    .in("id", projectIds);

  const results: { project: string; ok: boolean; detail: string }[] = [];

  // Последовательно, а не параллельно: Meta ограничивает частоту запросов,
  // и десяток кабинетов разом упрётся в лимит.
  for (const project of projects ?? []) {
    const credentials = await readIntegrationCredentialsAsPlatform(project.id, "meta");
    if (!credentials) {
      results.push({ project: project.name, ok: false, detail: "нет ключа" });
      continue;
    }

    const result = await runMetaSync({
      supabase: admin,
      projectId: project.id,
      projectCurrency: project.currency,
      adSpendRate: Number(project.ad_spend_rate),
      credentials,
      actorId: null,
    });

    results.push({
      project: project.name,
      ok: !result.error,
      detail: result.error ?? result.message ?? "",
    });
  }

  return json(200, { ok: true, projects: results.length, results });
}
