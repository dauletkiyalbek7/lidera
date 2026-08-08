import { NextResponse } from "next/server";

import { requireProjectContext } from "@/lib/auth";
import { readIntegrationCredentials } from "@/lib/queries/integrations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeAmoDomain } from "@/lib/amocrm";
import { runAmoCrmSync } from "@/lib/crm-sync/amocrm";
import { hasServiceRoleKey } from "@/lib/queries/employees";

/**
 * Импорт сделок из amoCRM по кнопке (ТЗ, Блок 4).
 * Права — владелец/директор. Пишем сервисным ключом (у роли нет своей политики
 * на запись лидов), поэтому проверяем доступ в коде.
 */
export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const { role, canManage } = await requireProjectContext(projectId);
  if (!(canManage || role === "director")) {
    return NextResponse.json({ error: "Нет прав на импорт." }, { status: 403 });
  }
  if (!hasServiceRoleKey()) {
    return NextResponse.json({ error: "На сервере нет ключа для записи." }, { status: 503 });
  }

  const credentials = await readIntegrationCredentials(projectId, "amocrm");
  if (!credentials || !credentials.account) {
    return NextResponse.json({ error: "amoCRM не подключена." }, { status: 409 });
  }

  const admin = createSupabaseAdminClient();
  const result = await runAmoCrmSync({
    admin,
    projectId,
    domain: normalizeAmoDomain(credentials.account),
    token: credentials.token,
  });

  return NextResponse.json(result, {
    status: result.error ? 502 : 200,
    headers: { "Cache-Control": "no-store" },
  });
}
