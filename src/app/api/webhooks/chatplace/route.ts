import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  channelToLeadSource,
  extractPhone,
  hashChatToken,
  parseChatEvent,
} from "@/lib/chat";
import type { ChatReferral } from "@/lib/chat";
import { assignIncomingLead } from "@/lib/leads/assign";
import { notifyNewLead } from "@/lib/notify";
import { hasServiceRoleKey } from "@/lib/queries/employees";

/**
 * Вебхук чат-бота ChatPlace (ТЗ, Блок 4).
 * Публичный маршрут: сессии нет, вместо неё токен проекта.
 * Пишем сервисным ключом — запрос приходит от чужого сервера, RLS тут не помощник.
 */

const MAX_BODY_BYTES = 32 * 1024;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Находит объявление по идентификатору из рекламного кабинета, а если такого
 * ещё нет — заводит.
 *
 * Заводить приходится: синхронизация с Meta может отстать, а заявка уже пришла.
 * Потерять её привязку хуже, чем на время подержать строку с одним id — при
 * следующей синхронизации она дополнится названием и картинкой.
 */
async function resolveCreativeId(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  projectId: string,
  referral: ChatReferral,
): Promise<string | null> {
  const { data: found } = await admin
    .from("creatives")
    .select("id")
    .eq("project_id", projectId)
    .eq("platform", "meta")
    .eq("external_id", referral.adExternalId)
    .maybeSingle();

  if (found) return found.id;

  const { data: created } = await admin
    .from("creatives")
    .insert({
      project_id: projectId,
      name: referral.headline ?? `Объявление ${referral.adExternalId}`,
      platform: "meta",
      external_id: referral.adExternalId,
    })
    .select("id")
    .maybeSingle();

  return created?.id ?? null;
}

function readToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return request.nextUrl.searchParams.get("token")?.trim() || null;
}

export async function POST(request: NextRequest) {
  if (!hasServiceRoleKey()) {
    return json(503, { error: "Чат-бот не настроен на сервере." });
  }

  const token = readToken(request);
  if (!token) return json(401, { error: "Не передан токен вебхука." });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Слишком большое тело запроса." });

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return json(400, { error: "Тело запроса не разобралось как JSON." });
  }

  const parsed = parseChatEvent(body);
  if (!parsed.ok) return json(400, { error: parsed.error });

  const admin = createSupabaseAdminClient();

  const { data: hook } = await admin
    .from("chat_webhooks")
    .select("project_id, received_count")
    .eq("token_hash", hashChatToken(token))
    .maybeSingle();

  if (!hook) return json(401, { error: "Токен не найден или отозван." });

  const projectId = hook.project_id;
  const { event } = parsed;
  const now = new Date().toISOString();

  // Телефон из полей события надёжнее; если его нет — ищем в тексте сообщения.
  const phone = event.contactPhone ?? extractPhone(event.body);

  // Meta присылает объявление только с первым сообщением, поэтому запоминаем
  // его на переписке: телефон может появиться намного позже.
  const creativeId = event.referral
    ? await resolveCreativeId(admin, projectId, event.referral)
    : null;

  const { data: existing } = await admin
    .from("chat_conversations")
    .select("id, message_count, lead_id, contact_phone, contact_name, creative_id")
    .eq("project_id", projectId)
    .eq("channel", event.channel)
    .eq("external_id", event.externalId)
    .maybeSingle();

  let conversationId = existing?.id ?? null;
  // Первая реклама сильнее: если человек вернулся по другому объявлению,
  // заявку всё равно принесло первое.
  const conversationCreativeId = existing?.creative_id ?? creativeId;

  if (existing) {
    await admin
      .from("chat_conversations")
      .update({
        contact_name: event.contactName ?? existing.contact_name,
        contact_phone: phone ?? existing.contact_phone,
        last_message: event.body,
        last_message_at: now,
        message_count: existing.message_count + 1,
        creative_id: conversationCreativeId,
        ...(event.referral?.headline ? { ad_headline: event.referral.headline } : {}),
      })
      .eq("id", existing.id);
  } else {
    const { data: created, error } = await admin
      .from("chat_conversations")
      .insert({
        project_id: projectId,
        channel: event.channel,
        external_id: event.externalId,
        contact_name: event.contactName,
        contact_phone: phone,
        last_message: event.body,
        last_message_at: now,
        message_count: 1,
        creative_id: creativeId,
        ad_headline: event.referral?.headline ?? null,
      })
      .select("id")
      .single();

    if (error || !created) return json(500, { error: "Не удалось сохранить переписку." });
    conversationId = created.id;
  }

  await admin.from("chat_messages").insert({
    project_id: projectId,
    conversation_id: conversationId as string,
    direction: event.direction,
    body: event.body,
  });

  // Главное правило раздела: номер появился — появился лид.
  // Второй раз лид не заводим, иначе одна переписка размножится в CRM.
  let leadId = existing?.lead_id ?? null;
  const knownPhone = existing?.contact_phone ?? null;

  if (!leadId && (phone ?? knownPhone)) {
    const source = channelToLeadSource(event.channel);
    const { data: lead } = await admin
      .from("leads")
      .insert({
        project_id: projectId,
        full_name: event.contactName ?? existing?.contact_name ?? (phone as string),
        phone: phone ?? knownPhone,
        source,
        status: "new",
        creative_id: conversationCreativeId,
      })
      .select("id")
      .single();

    if (lead) {
      leadId = lead.id;
      await admin
        .from("chat_conversations")
        .update({ lead_id: leadId })
        .eq("id", conversationId as string);

      await admin.from("activity_log").insert({
        project_id: projectId,
        actor_id: null,
        action: "chat.lead_created",
        details: { channel: event.channel, source, creative_id: conversationCreativeId },
      });

      const assignedTo = await assignIncomingLead(admin, projectId, leadId);

      await notifyNewLead(admin, projectId, {
        fullName: event.contactName ?? existing?.contact_name ?? (phone as string),
        phone: phone ?? knownPhone,
        source,
        assignedTo,
        adHeadline: event.referral?.headline ?? null,
      });
    }
  }

  await admin
    .from("chat_webhooks")
    .update({ received_count: hook.received_count + 1, last_received_at: now })
    .eq("project_id", projectId);

  return json(201, {
    ok: true,
    conversation_id: conversationId,
    lead_id: leadId,
    phone_found: Boolean(phone ?? knownPhone),
    // Видно в ответе, чтобы при подключении ChatPlace сразу понять,
    // доезжает ли до нас объявление или его надо искать в другом поле.
    ad_external_id: event.referral?.adExternalId ?? null,
  });
}

/** GET оставляем для проверки «жив ли адрес» — события он не принимает. */
export function GET() {
  return json(405, { error: "События принимаются методом POST." });
}
