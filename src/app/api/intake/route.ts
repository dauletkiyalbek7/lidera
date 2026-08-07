import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashIntakeToken, parseIntakePayload } from "@/lib/intake";
import { assignIncomingLead } from "@/lib/leads/assign";
import { notifyNewLead } from "@/lib/notify";
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

  // Сайты шлют по-разному: наш пример — JSON, а Tilda и обычные формы —
  // application/x-www-form-urlencoded. Принимаем оба, чтобы не терять заявки.
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  let body: unknown;
  if (contentType.includes("application/x-www-form-urlencoded")) {
    body = Object.fromEntries(new URLSearchParams(raw));
  } else {
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      // Форму прислали без заголовка типа — пробуем разобрать как форму.
      body = Object.fromEntries(new URLSearchParams(raw));
    }
  }

  const parsed = parseIntakePayload(body);
  if (!parsed.ok) {
    // Tilda при подключении вебхука шлёт тест-пинг (поле test) без имени и
    // телефона — отвечаем ок, чтобы Tilda приняла адрес, но лид не заводим.
    if (body && typeof body === "object" && "test" in (body as Record<string, unknown>)) {
      return json(200, { ok: true, test: true });
    }
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

  // Креатив ищем по UTM-метке (её владелец задаёт сам на креативе и ставит в
  // ссылку объявления как utm_content), затем по id объявления, затем по имени.
  // Метка — главный путь: она стабильна и не зависит от имени объявления в Meta.
  // Не нашли — заводим: новое объявление не должно терять свои заявки.
  let creativeId: string | null = null;
  const label = payload.creativeName?.trim() || null;
  if (label || payload.creativeExternalId) {
    let found: { id: string } | null = null;

    if (label) {
      const { data } = await admin
        .from("creatives")
        .select("id")
        .eq("project_id", projectId)
        .ilike("utm_label", label)
        .maybeSingle();
      found = data ?? null;
    }
    if (!found && payload.creativeExternalId) {
      const { data } = await admin
        .from("creatives")
        .select("id")
        .eq("project_id", projectId)
        .eq("external_id", payload.creativeExternalId)
        .maybeSingle();
      found = data ?? null;
    }
    if (!found && label) {
      const { data } = await admin
        .from("creatives")
        .select("id")
        .eq("project_id", projectId)
        .eq("name", label)
        .maybeSingle();
      found = data ?? null;
    }

    if (found) {
      creativeId = found.id;
    } else {
      // Метка встретилась раньше синка: заводим креатив с меткой и id, что пришло,
      // — синхронизация Meta потом дополнит его именем и картинкой.
      const { data: created } = await admin
        .from("creatives")
        .insert({
          project_id: projectId,
          name: label ?? (payload.creativeExternalId as string),
          utm_label: label,
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

  // Раздаём сразу, если есть кто на смене; иначе лид ждёт кнопки «Авто-раздача».
  const assignedTo = await assignIncomingLead(admin, projectId, lead.id);

  await notifyNewLead(admin, projectId, {
    fullName: payload.fullName,
    phone: payload.phone,
    source: payload.source,
    assignedTo,
    adHeadline: null,
  });

  return json(201, { ok: true, lead_id: lead.id, creative_id: creativeId, assigned_to: assignedTo });
}

/** GET оставляем для проверки «жив ли адрес» — заявки он не принимает. */
export function GET() {
  return json(405, { error: "Заявки принимаются методом POST." });
}
