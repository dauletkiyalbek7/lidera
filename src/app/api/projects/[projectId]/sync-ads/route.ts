import { NextResponse } from "next/server";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readIntegrationCredentials } from "@/lib/queries/integrations";
import { runMetaSync } from "@/lib/ads/sync";
import type { Json } from "@/lib/database.types";

/**
 * Обновление рекламы при заходе на раздел.
 * Кнопки синхронизации на экране больше нет: страница сама зовёт этот маршрут,
 * если данные устарели. Права проверяются сессией — маршрут не публичный.
 *
 * Пауза-остывание: если прошлая попытка упёрлась в лимит Meta, какое-то время
 * в кабинет не ходим. Иначе каждый заход на страницу с несвежими данными снова
 * дёргает Meta, и аккаунт не выходит из throttle — данные застревают навсегда.
 */

export const maxDuration = 300;

/** После лимита Meta ждём час; после иной ошибки — короче, чтобы не долбить. */
const COOLDOWN_RATE_LIMIT_MIN = 60;
const COOLDOWN_OTHER_MIN = 15;

function isRateLimited(error: string): boolean {
  return /too many calls|80004|rate limit/i.test(error);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const { project, role, canManage, user } = await requireProjectContext(projectId);
  if (!(canManage || role === "director")) {
    return NextResponse.json({ error: "Нет прав на обновление." }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: integ } = await supabase
    .from("integrations")
    .select("id, config")
    .eq("project_id", projectId)
    .eq("provider", "meta")
    .maybeSingle();

  const config = (integ?.config ?? {}) as Record<string, unknown>;
  const pausedUntil =
    typeof config.sync_paused_until === "string" ? Date.parse(config.sync_paused_until) : 0;

  // На паузе после лимита — не ходим в Meta, отвечаем спокойно (не ошибкой).
  if (pausedUntil && Date.now() < pausedUntil) {
    return NextResponse.json(
      { skipped: true, reason: "Обновление на паузе: Meta недавно ответила лимитом.", pausedUntil: config.sync_paused_until },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  const credentials = await readIntegrationCredentials(projectId, "meta");
  if (!credentials) {
    return NextResponse.json({ error: "Meta Ads не подключена." }, { status: 409 });
  }

  const result = await runMetaSync({
    supabase,
    projectId,
    projectCurrency: project.currency,
    adSpendRate: Number(project.ad_spend_rate),
    credentials,
    actorId: user.id,
  });

  // Обновляем паузу по итогу: ошибка — ставим остывание; успех — снимаем.
  if (integ?.id) {
    if (result.error) {
      const minutes = isRateLimited(result.error) ? COOLDOWN_RATE_LIMIT_MIN : COOLDOWN_OTHER_MIN;
      const until = new Date(Date.now() + minutes * 60_000).toISOString();
      await supabase
        .from("integrations")
        .update({ config: { ...config, sync_paused_until: until } as Json })
        .eq("id", integ.id);
    } else if (config.sync_paused_until) {
      const next = { ...config };
      delete next.sync_paused_until;
      await supabase.from("integrations").update({ config: next as Json }).eq("id", integ.id);
    }
  }

  return NextResponse.json(result, {
    status: result.error ? 502 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
