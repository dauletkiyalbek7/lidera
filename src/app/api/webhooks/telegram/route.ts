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
  capiChoiceKeyboard,
  CAPI_SEND_PREFIX,
  CAPI_SKIP_PREFIX,
  locationRequestKeyboard,
  renderAskCapi,
  renderCapiFailed,
  renderCapiSent,
  renderCapiSkipped,
  renderCheckedIn,
  renderMetrics,
  renderNoAwaitingSale,
  renderNotLinked,
  renderOutsideOffice,
  renderReportCancelled,
  renderReportPrompt,
  renderReportSaved,
  renderRequestLocation,
  renderShiftChanged,
  renderWelcome,
} from "@/lib/telegram-bot";
import {
  advanceReport,
  cancelReport,
  confirmLatestReceipt,
  findLinkedAccount,
  loadBotMetrics,
  reportStep,
  sendSaleCapi,
  skipSaleCapi,
  startReport,
} from "@/lib/queries/telegram-bot";
import { loadOffice, recordCheckIn, recordCheckOut, recordManualShift } from "@/lib/attendance";
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
    // Выбор «слать ли чек в Meta» — продажник решает сам после подтверждения.
    if (callback.data.startsWith(CAPI_SEND_PREFIX)) {
      const saleId = callback.data.slice(CAPI_SEND_PREFIX.length);
      const result = await sendSaleCapi(admin, projectId, saleId, account.userId);
      await send(callback.chatId, result?.ok ? renderCapiSent() : renderCapiFailed());
      return json(200, { ok: true, capi: result?.ok ? "sent" : "failed" });
    }
    if (callback.data.startsWith(CAPI_SKIP_PREFIX)) {
      const saleId = callback.data.slice(CAPI_SKIP_PREFIX.length);
      await skipSaleCapi(admin, projectId, saleId, account.userId);
      await send(callback.chatId, renderCapiSkipped());
      return json(200, { ok: true, capi: "skipped" });
    }
    if (callback.data === BOT_ACTIONS.metrics) {
      await showMetrics(callback.chatId, account);
    } else if (callback.data === BOT_ACTIONS.report) {
      const step = await startReport(admin, projectId, account.userId);
      await send(callback.chatId, renderReportPrompt(step));
    } else if (callback.data === BOT_ACTIONS.shiftOn) {
      // Есть геозона — просим геолокацию; нет — отмечаемся вручную (запасной вариант).
      const office = await loadOffice(admin, projectId);
      if (office) {
        await send(callback.chatId, renderRequestLocation(), locationRequestKeyboard());
      } else {
        await recordManualShift(admin, projectId, account.userId);
        await send(
          callback.chatId,
          renderShiftChanged(true, account.role),
          botMenu(account.role, true),
        );
      }
    } else if (callback.data === BOT_ACTIONS.shiftOff) {
      await recordCheckOut(admin, projectId, account.userId);
      await send(
        callback.chatId,
        renderShiftChanged(false, account.role),
        botMenu(account.role, false),
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

  /* Геолокация — отметка о приходе: внутри радиуса ставим на смену. */
  if (update.location) {
    const result = await recordCheckIn(
      admin,
      projectId,
      account.userId,
      update.location.lat,
      update.location.lng,
    );
    if (result.ok) {
      await send(
        update.chatId,
        renderCheckedIn(account.role, result.geofenced),
        botMenu(account.role, true),
      );
    } else {
      await send(update.chatId, renderOutsideOffice(result.distance ?? 0, result.radius ?? 0));
    }
    return json(200, { ok: true, checkIn: result.ok });
  }

  /* Вложение — это чек о покупке: привязываем к последней продаже продажника.
     Подтверждаем чек и спрашиваем, слать ли клиента в рекламу (решает продажник). */
  if (update.attachmentFileId) {
    const [confirmed, currency] = await Promise.all([
      confirmLatestReceipt(admin, projectId, account.userId, update.attachmentFileId),
      projectCurrency(admin, projectId),
    ]);
    if (confirmed) {
      await send(
        update.chatId,
        renderAskCapi(confirmed.product, confirmed.amount, currency),
        capiChoiceKeyboard(confirmed.saleId),
      );
    } else {
      await send(update.chatId, renderNoAwaitingSale());
    }
    return json(200, { ok: true, receipt: Boolean(confirmed) });
  }

  const rawText = update.text ?? "";
  const text = rawText.toLowerCase().trim();

  /* Пока идёт отчёт, текст — это ответы на вопросы (приоритет над меню). */
  const step = await reportStep(admin, projectId, account.userId);
  if (step !== null) {
    if (text === "отмена" || text === "отменить" || text === "/cancel") {
      await cancelReport(admin, projectId, account.userId);
      await send(update.chatId, renderReportCancelled(), botMenu(account.role, account.onShift));
    } else {
      const result = await advanceReport(admin, projectId, account.userId, rawText);
      if (result.finished) {
        await send(update.chatId, renderReportSaved(), botMenu(account.role, account.onShift));
      } else {
        await send(update.chatId, renderReportPrompt(result.nextStep ?? 0, result.reask));
      }
    }
    return json(200, { ok: true, report: true });
  }

  if (text.startsWith("/metrics") || text.includes("показател")) {
    await showMetrics(update.chatId, account);
  } else if (text.startsWith("/report") || text.includes("отчёт") || text.includes("отчет")) {
    const first = await startReport(admin, projectId, account.userId);
    await send(update.chatId, renderReportPrompt(first));
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
