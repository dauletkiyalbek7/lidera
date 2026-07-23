import { NextResponse, type NextRequest } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readIntegrationCredentialsAsPlatform } from "@/lib/queries/integrations";
import {
  answerCallbackQuery,
  extractLinkCode,
  hashTelegramToken,
  parseCallbackQuery,
  parseTelegramUpdate,
  sendTelegramMessage,
} from "@/lib/telegram";
import {
  BOT_ACTIONS,
  botMenu,
  renderMetrics,
  renderNoAwaitingSale,
  renderNotLinked,
  renderReceiptConfirmed,
  renderReportStub,
  renderShiftChanged,
  renderWelcome,
} from "@/lib/telegram-bot";
import {
  confirmLatestReceipt,
  findLinkedAccount,
  loadBotMetrics,
  setShift,
} from "@/lib/queries/telegram-bot";
import { hasServiceRoleKey } from "@/lib/queries/employees";

/**
 * Вебхук Telegram-бота (ТЗ, раздел 7: Настройки → Telegram-бот).
 *
 * Делает три вещи: привязывает чат к учётке по коду из личной ссылки,
 * отвечает на кнопки меню и показывает сотруднику его показатели.
 * Telegram шлёт секрет заголовком X-Telegram-Bot-Api-Secret-Token.
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

type Admin = ReturnType<typeof createSupabaseAdminClient>;

async function projectCurrency(admin: Admin, projectId: string): Promise<string> {
  const { data } = await admin.from("projects").select("currency").eq("id", projectId).single();
  return data?.currency ?? "KZT";
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

  // Токен бота — чтобы отвечать. Без него привязка всё равно состоится,
  // просто человек не увидит ответа.
  const credentials = await readIntegrationCredentialsAsPlatform(projectId, "telegram");
  const botToken = credentials?.token ?? null;
  const send = (chatId: string, text: string, markup?: unknown) =>
    botToken ? sendTelegramMessage(botToken, chatId, text, markup) : Promise.resolve(false);

  const showMetrics = async (
    chatId: string,
    account: { userId: string; role: Parameters<typeof loadBotMetrics>[3] },
  ) => {
    const [metrics, currency] = await Promise.all([
      loadBotMetrics(admin, projectId, account.userId, account.role),
      projectCurrency(admin, projectId),
    ]);
    await send(chatId, renderMetrics(metrics, currency));
  };

  /* ------------------------- нажатие кнопки меню ------------------------- */
  const callback = parseCallbackQuery(body);
  if (callback) {
    if (botToken) await answerCallbackQuery(botToken, callback.id);
    const account = await findLinkedAccount(admin, projectId, callback.chatId);
    if (!account) {
      await send(callback.chatId, renderNotLinked());
      return json(200, { ok: true, linked: false });
    }
    if (callback.data === BOT_ACTIONS.metrics) {
      await showMetrics(callback.chatId, account);
    } else if (callback.data === BOT_ACTIONS.report) {
      await send(callback.chatId, renderReportStub());
    } else if (
      callback.data === BOT_ACTIONS.shiftOn ||
      callback.data === BOT_ACTIONS.shiftOff
    ) {
      const onShift = callback.data === BOT_ACTIONS.shiftOn;
      await setShift(admin, projectId, account.userId, onShift);
      await send(
        callback.chatId,
        renderShiftChanged(onShift, account.role),
        botMenu(account.role, onShift),
      );
    } else {
      await send(
        callback.chatId,
        renderWelcome(account.fullName, account.role, account.onShift, false),
        botMenu(account.role, account.onShift),
      );
    }
    return json(200, { ok: true, action: callback.data });
  }

  /* ---------------------------- сообщение ------------------------------ */
  const parsed = parseTelegramUpdate(body);
  // Прочее (вступления в чат, реакции) подтверждаем, чтобы Telegram не повторял.
  if (!parsed.ok) return json(200, { ok: true, skipped: parsed.error });

  const { update } = parsed;
  const code = extractLinkCode(update.text);

  /* Привязка по коду из личной ссылки. */
  if (code) {
    const { data: account } = await admin
      .from("telegram_accounts")
      .select("id, status, user_id")
      .eq("project_id", projectId)
      .eq("code", code)
      .maybeSingle();

    if (!account) {
      await send(update.chatId, "Ссылка недействительна. Попросите руководителя прислать новую.");
      return json(200, { ok: true, linked: false, reason: "code_not_found" });
    }

    if (account.status === "linked") {
      await send(update.chatId, "Эта ссылка уже использована.");
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

    const linked = await findLinkedAccount(admin, projectId, update.chatId);
    if (linked) {
      await send(
        update.chatId,
        renderWelcome(linked.fullName, linked.role, linked.onShift, true),
        botMenu(linked.role, linked.onShift),
      );
    }
    return json(200, { ok: true, linked: true, user_id: account.user_id });
  }

  /* Без кода — команды уже привязанного сотрудника. */
  const account = await findLinkedAccount(admin, projectId, update.chatId);
  if (!account) {
    await send(update.chatId, renderNotLinked());
    return json(200, { ok: true, linked: false });
  }

  /* Вложение — это чек о покупке: привязываем к последней продаже продажника. */
  if (update.attachmentFileId) {
    const [confirmed, currency] = await Promise.all([
      confirmLatestReceipt(admin, projectId, account.userId, update.attachmentFileId),
      projectCurrency(admin, projectId),
    ]);
    await send(
      update.chatId,
      confirmed
        ? renderReceiptConfirmed(confirmed.product, confirmed.amount, currency)
        : renderNoAwaitingSale(),
    );
    return json(200, { ok: true, receipt: Boolean(confirmed) });
  }

  const text = (update.text ?? "").toLowerCase();
  if (text.startsWith("/metrics") || text.includes("показател")) {
    await showMetrics(update.chatId, account);
  } else if (text.startsWith("/report") || text.includes("отчёт") || text.includes("отчет")) {
    await send(update.chatId, renderReportStub());
  } else {
    await send(
      update.chatId,
      renderWelcome(account.fullName, account.role, account.onShift, false),
      botMenu(account.role, account.onShift),
    );
  }
  return json(200, { ok: true, linked: true });
}

/** GET оставляем для проверки «жив ли адрес» — обновления он не принимает. */
export function GET() {
  return json(405, { error: "Обновления принимаются методом POST." });
}
