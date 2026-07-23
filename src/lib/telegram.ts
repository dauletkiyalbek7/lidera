import { createHash, randomBytes, randomInt } from "node:crypto";

/**
 * Telegram-бот платформы (ТЗ, раздел 7: Настройки → Telegram-бот).
 *
 * Привязка устроена так: директор выдаёт сотруднику одноразовый код,
 * сотрудник отправляет его боту, бот сообщает нам chat_id — и учётка связана.
 * Пароль в переписку не попадает, а чужой код бесполезен: он одноразовый
 * и привязан к конкретному проекту.
 */

const TOKEN_BYTES = 24;
const HINT_LENGTH = 4;

export function generateTelegramToken(): string {
  return `tgw_${randomBytes(TOKEN_BYTES).toString("base64url")}`;
}

export function hashTelegramToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function telegramHint(token: string): string {
  return `…${token.slice(-HINT_LENGTH)}`;
}

/** Без похожих друг на друга символов: код диктуют вслух и переписывают руками. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
export const CODE_PREFIX = "LID-";

export function generateLinkCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return `${CODE_PREFIX}${code}`;
}

const CODE_PATTERN = new RegExp(`${CODE_PREFIX}[${CODE_ALPHABET}]{${CODE_LENGTH}}`);

/**
 * Достаёт код из сообщения.
 * Принимаем и «/start LID-AB12CD», и просто код, и код в середине фразы —
 * человек напишет как получится.
 */
export function extractLinkCode(text: string | null | undefined): string | null {
  if (!text) return null;
  const normalized = text.toUpperCase().replace(/\s+/g, " ").trim();
  return normalized.match(CODE_PATTERN)?.[0] ?? null;
}

/* -------------------------------- update -------------------------------- */

const MAX_TEXT = 2000;
const MAX_NAME = 200;

export type TelegramUpdate = {
  chatId: string;
  username: string | null;
  fullName: string | null;
  text: string | null;
  /** file_id вложения (фото или документа) — им приходит чек о покупке. */
  attachmentFileId: string | null;
};

export type TelegramParseResult =
  | { ok: true; update: TelegramUpdate }
  | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * file_id вложения: у фото это последний (самый крупный) размер из массива photo,
 * у файла — document.file_id. Именно так клиент присылает чек о покупке.
 */
function readAttachmentFileId(message: Record<string, unknown>): string | null {
  const photo = Array.isArray(message.photo) ? message.photo : null;
  if (photo && photo.length > 0) {
    const largest = asRecord(photo[photo.length - 1]);
    const id = largest ? readText(largest.file_id) : null;
    if (id) return id;
  }
  const document = asRecord(message.document);
  return document ? readText(document.file_id) : null;
}

/**
 * Разбирает update Telegram.
 * Нас интересует одно: из какого чата пришло сообщение и что в нём написано.
 * Редактирование сообщения (edited_message) обрабатываем так же — человек
 * вполне может исправить опечатку в коде вместо повторной отправки.
 */
export function parseTelegramUpdate(body: unknown): TelegramParseResult {
  const root = asRecord(body);
  if (!root) return { ok: false, error: "Ожидался объект JSON." };

  const message = asRecord(root.message) ?? asRecord(root.edited_message);
  if (!message) return { ok: false, error: "В обновлении нет сообщения." };

  const chat = asRecord(message.chat);
  const chatId = chat ? readText(chat.id) ?? (typeof chat.id === "number" ? String(chat.id) : null) : null;
  if (!chatId) return { ok: false, error: "В сообщении нет chat.id." };

  const from = asRecord(message.from);
  const firstName = from ? readText(from.first_name) : null;
  const lastName = from ? readText(from.last_name) : null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || null;

  return {
    ok: true,
    update: {
      chatId,
      username: from ? readText(from.username)?.slice(0, MAX_NAME) ?? null : null,
      fullName: fullName ? fullName.slice(0, MAX_NAME) : null,
      text: (readText(message.text) ?? readText(message.caption))?.slice(0, MAX_TEXT) ?? null,
      attachmentFileId: readAttachmentFileId(message),
    },
  };
}

/* -------------------------------- отправка ------------------------------- */

const TELEGRAM_API = "https://api.telegram.org";

/**
 * Ответ бота. Требует токена от @BotFather — без него привязка всё равно
 * состоится, просто человек не увидит подтверждения в чате.
 * Ошибку глотаем: сорванный ответ не должен ронять приём вебхука.
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  text: string,
  replyMarkup?: unknown,
): Promise<boolean> {
  try {
    const response = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Гасит «часики» на нажатой кнопке. Без этого Telegram крутит загрузку
 * несколько секунд, будто бот завис.
 */
export async function answerCallbackQuery(botToken: string, callbackId: string): Promise<void> {
  try {
    await fetch(`${TELEGRAM_API}/bot${botToken}/answerCallbackQuery`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackId }),
    });
  } catch {
    // Ответ на нажатие не критичен — молчим.
  }
}

/** Разбирает нажатие кнопки меню (callback_query). */
export type CallbackQuery = { id: string; chatId: string; data: string };

export function parseCallbackQuery(body: unknown): CallbackQuery | null {
  const root = asRecord(body);
  const callback = root ? asRecord(root.callback_query) : null;
  if (!callback) return null;

  const id = readText(callback.id) ?? (typeof callback.id === "number" ? String(callback.id) : null);
  const data = readText(callback.data);
  const message = asRecord(callback.message);
  const chat = message ? asRecord(message.chat) : null;
  const chatId = chat
    ? readText(chat.id) ?? (typeof chat.id === "number" ? String(chat.id) : null)
    : null;

  if (!id || !data || !chatId) return null;
  return { id, chatId, data };
}
