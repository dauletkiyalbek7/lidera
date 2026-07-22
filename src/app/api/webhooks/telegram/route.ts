import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readIntegrationCredentialsAsPlatform } from "@/lib/queries/integrations";
import {
  extractLinkCode,
  hashTelegramToken,
  parseTelegramUpdate,
  sendTelegramMessage,
} from "@/lib/telegram";
import { hasServiceRoleKey } from "@/lib/queries/employees";

/**
 * Вебхук Telegram-бота (ТЗ, раздел 7: Настройки → Telegram-бот).
 * Сотрудник присылает боту свой код — здесь его чат связывается с учёткой.
 *
 * Telegram шлёт секрет заголовком X-Telegram-Bot-Api-Secret-Token; принимаем
 * также Bearer и ?token= — чтобы адрес можно было проверить обычным curl.
 */

const MAX_BODY_BYTES = 64 * 1024;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function readToken(request: NextRequest): string | null {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret?.trim()) return secret.trim();

  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();

  return request.nextUrl.searchParams.get("token")?.trim() || null;
}

/** Ответ боту не обязателен: без токена от @BotFather привязка всё равно состоится. */
async function reply(projectId: string, chatId: string, text: string): Promise<void> {
  const credentials = await readIntegrationCredentialsAsPlatform(projectId, "telegram");
  if (!credentials) return;
  await sendTelegramMessage(credentials.token, chatId, text);
}

export async function POST(request: NextRequest) {
  if (!hasServiceRoleKey()) {
    return json(503, { error: "Telegram-бот не настроен на сервере." });
  }

  const token = readToken(request);
  if (!token) return json(401, { error: "Не передан секрет вебхука." });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "Слишком большое тело запроса." });

  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return json(400, { error: "Тело запроса не разобралось как JSON." });
  }

  const admin = createSupabaseAdminClient();
  const { data: hook } = await admin
    .from("telegram_webhooks")
    .select("project_id, received_count")
    .eq("token_hash", hashTelegramToken(token))
    .maybeSingle();

  if (!hook) return json(401, { error: "Секрет не найден или отозван." });

  const projectId = hook.project_id;
  const now = new Date().toISOString();

  await admin
    .from("telegram_webhooks")
    .update({ received_count: hook.received_count + 1, last_received_at: now })
    .eq("project_id", projectId);

  const parsed = parseTelegramUpdate(body);
  // Обновления, которые нам не по адресу (вступления в чат, реакции),
  // подтверждаем ok: иначе Telegram будет слать их снова и снова.
  if (!parsed.ok) return json(200, { ok: true, skipped: parsed.error });

  const { update } = parsed;
  const code = extractLinkCode(update.text);

  if (!code) {
    await reply(
      projectId,
      update.chatId,
      "Пришлите код привязки — его выдаёт директор в разделе «Настройки → Telegram-бот».",
    );
    return json(200, { ok: true, linked: false });
  }

  const { data: account } = await admin
    .from("telegram_accounts")
    .select("id, status, user_id")
    .eq("project_id", projectId)
    .eq("code", code)
    .maybeSingle();

  if (!account) {
    await reply(projectId, update.chatId, "Код не найден. Попросите директора выдать новый.");
    return json(200, { ok: true, linked: false, reason: "code_not_found" });
  }

  if (account.status === "linked") {
    await reply(projectId, update.chatId, "Этот код уже использован.");
    return json(200, { ok: true, linked: false, reason: "code_used" });
  }

  const { error } = await admin
    .from("telegram_accounts")
    .update({
      chat_id: update.chatId,
      username: update.username,
      status: "linked",
      linked_at: now,
    })
    .eq("id", account.id);

  if (error) return json(500, { error: "Не удалось сохранить привязку." });

  await admin.from("activity_log").insert({
    project_id: projectId,
    actor_id: account.user_id,
    action: "telegram.linked",
    details: { username: update.username },
  });

  await reply(projectId, update.chatId, "Готово: чат привязан к вашей учётке в Lidera.");

  return json(200, { ok: true, linked: true, user_id: account.user_id });
}

/** GET оставляем для проверки «жив ли адрес» — обновления он не принимает. */
export function GET() {
  return json(405, { error: "Обновления принимаются методом POST." });
}
