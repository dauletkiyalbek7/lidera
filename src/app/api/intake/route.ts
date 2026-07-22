import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashIntakeToken, parseIntakePayload } from "@/lib/intake";
import { hasServiceRoleKey } from "@/lib/queries/employees";

/**
 * Приём заявок с сайта, лендинга и Tilda (ТЗ, Блок 3).
 * Публичный маршрут: сессии нет, вместо неё токен проекта.
 * Проверка токена и запись идут сервисным ключом — RLS здесь не помощник,
 * потому что запрос приходит от постороннего сервера, а не от пользователя.
 */

/** Больше этого тело быть не может: защита от мусора и случайных дампов. */
const MAX_BODY_BYTES = 16 * 1024;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function readToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  const query = request.nextUrl.searchParams.get("token");
  return query?.trim() || null;
}

export async function POST(request: NextRequest) {
  if (!hasServiceRoleKey()) {
    return json(503, { error: "Приём заявок не настроен на сервере." });
  }

  const token = readToken(request);
  if (!token) {
    return json(401, { error: "Не передан токен приёма заявок." });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return json(413, { error: "Слишком большое тело запроса." });
  }

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return json(400, { error: "Тело запроса не разобралось как JSON." });
  }

  const parsed = parseIntakePayload(body);
  if (!parsed.ok) {
    return json(400, { error: parsed.error });
  }

  const admin = createSupabaseAdminClient();

  // Ищем по отпечатку: сам токен в базе не хранится.
  const { data: intake } = await admin
    .from("lead_intake")
    .select("project_id, received_count")
    .eq("token_hash", hashIntakeToken(token))
    .maybeSingle();

  if (!intake) {
    return json(401, { error: "Токен не найден или отозван." });
  }

  const { payload } = parsed;
  const projectId = intake.project_id;

  // Креатив ищем по id объявления, потом по названию.
  // Не нашли — заводим: новое объявление не должно терять свои заявки.
  let creativeId: string | null = null;
  if (payload.creativeExternalId || payload.creativeName) {
    const { data: existing } = payload.creativeExternalId
      ? await admin
          .from("creatives")
          .select("id")
          .eq("project_id", projectId)
          .eq("external_id", payload.creativeExternalId)
          .maybeSingle()
      : await admin
          .from("creatives")
          .select("id")
          .eq("project_id", projectId)
          .eq("name", payload.creativeName as string)
          .maybeSingle();

    if (existing) {
      creativeId = existing.id;
    } else {
      const { data: created } = await admin
        .from("creatives")
        .insert({
          project_id: projectId,
          name: payload.creativeName ?? (payload.creativeExternalId as string),
          external_id: payload.creativeExternalId,
          platform: payload.platform,
        })
        .select("id")
        .maybeSingle();
      creativeId = created?.id ?? null;
    }
  }

  const { data: lead, error } = await admin
    .from("leads")
    .insert({
      project_id: projectId,
      full_name: payload.fullName,
      phone: payload.phone,
      source: payload.source,
      status: "new",
      value: payload.value,
      creative_id: creativeId,
    })
    .select("id")
    .single();

  if (error || !lead) {
    return json(500, { error: "Не удалось сохранить заявку." });
  }

  await admin
    .from("lead_intake")
    .update({
      received_count: intake.received_count + 1,
      last_received_at: new Date().toISOString(),
    })
    .eq("project_id", projectId);

  await admin.from("activity_log").insert({
    project_id: projectId,
    actor_id: null,
    action: "lead.received",
    details: { source: payload.source, creative_id: creativeId },
  });

  return json(201, { ok: true, lead_id: lead.id, creative_id: creativeId });
}

/** GET оставляем для проверки «жив ли адрес» — заявки он не принимает. */
export function GET() {
  return json(405, { error: "Заявки принимаются методом POST." });
}
