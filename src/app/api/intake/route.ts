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

  // Ищем настоящее объявление из синка. Главное: utm_content={{ad.id}} — это и
  // есть external_id объявления кабинета, поэтому его (и запасной id из ссылки)
  // сверяем в первую очередь с external_id — иначе создавали бы двойник без видео
  // и расхода. Затем — ручная UTM-метка, затем имя. Не нашли — заводим.
  let creativeId: string | null = null;
  const label = payload.creativeName?.trim() || null;
  // utm_content ({{ad.id}}) первым: по нашей инструкции это id объявления.
  const externalCandidates = [label, payload.creativeExternalId].filter(
    (value): value is string => Boolean(value),
  );

  if (label || externalCandidates.length > 0) {
    let found: { id: string } | null = null;

    for (const ext of externalCandidates) {
      if (found) break;
      const { data } = await admin
        .from("creatives")
        .select("id")
        .eq("project_id", projectId)
        .eq("external_id", ext)
        .maybeSingle();
      found = data ?? null;
    }
    if (!found && label) {
      const { data } = await admin
        .from("creatives")
        .select("id")
        .eq("project_id", projectId)
        .ilike("utm_label", label)
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
      // Заглушку заводим только под настоящий id объявления Meta — это длинный
      // числовой {{ad.id}} (17+ цифр). Тестовые и короткие метки (banner, 3333,
      // id кампании) пустышки не плодят: лид просто останется без креатива, пока
      // не придёт нормальный id. Следующий синк дольёт заглушке видео и расход.
      const adId = externalCandidates.find((value) => /^[0-9]{15,}$/.test(value)) ?? null;
      if (adId) {
        // Числовой id — не читаемая метка: utm_label оставляем только для слов.
        const readableLabel = label && !/^[0-9]+$/.test(label) ? label : null;
        const { data: created } = await admin
          .from("creatives")
          .insert({
            project_id: projectId,
            name: label ?? adId,
            utm_label: readableLabel,
            external_id: adId,
            platform: payload.platform,
          })
          .select("id")
          .maybeSingle();
        creativeId = created?.id ?? null;
      }
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
