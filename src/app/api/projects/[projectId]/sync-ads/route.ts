import { NextResponse } from "next/server";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readIntegrationCredentials } from "@/lib/queries/integrations";
import { runMetaSync } from "@/lib/ads/sync";

/**
 * Обновление рекламы при заходе на раздел.
 * Кнопки синхронизации на экране больше нет: страница сама зовёт этот маршрут,
 * если данные устарели. Права проверяются сессией — маршрут не публичный.
 */

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const { project, role, canManage, user } = await requireProjectContext(projectId);
  if (!(canManage || role === "director")) {
    return NextResponse.json({ error: "Нет прав на обновление." }, { status: 403 });
  }

  const credentials = await readIntegrationCredentials(projectId, "meta");
  if (!credentials) {
    return NextResponse.json({ error: "Meta Ads не подключена." }, { status: 409 });
  }

  const result = await runMetaSync({
    supabase: await createSupabaseServerClient(),
    projectId,
    projectCurrency: project.currency,
    adSpendRate: Number(project.ad_spend_rate),
    credentials,
    actorId: user.id,
  });

  return NextResponse.json(result, {
    status: result.error ? 502 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
