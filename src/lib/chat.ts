import { createHash, randomBytes } from "node:crypto";

/**
 * Чат-бот (ТЗ, Блок 4).
 * ChatPlace шлёт входящие сообщения на вебхук проекта. Наша задача одна:
 * заметить в переписке номер телефона и завести лид с правильным источником.
 *
 * Формат события у ChatPlace свой, у разных каналов поля называются по-разному,
 * поэтому имена принимаем в нескольких вариантах — как в приёме заявок с сайта.
 */

const TOKEN_BYTES = 24;
const HINT_LENGTH = 4;

export function generateChatToken(): string {
  return `cht_${randomBytes(TOKEN_BYTES).toString("base64url")}`;
}

/** В базе живёт только отпечаток: утечка таблицы не даёт слать события. */
export function hashChatToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function chatHint(token: string): string {
  return `…${token.slice(-HINT_LENGTH)}`;
}

/** Каналы ChatPlace, которые мы различаем на экране. */
export const CHAT_CHANNELS = [
  "whatsapp",
  "instagram",
  "facebook",
  "telegram",
  "other",
] as const;

export type ChatChannel = (typeof CHAT_CHANNELS)[number];

export const CHAT_CHANNEL_LABELS: Record<ChatChannel, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  telegram: "Telegram",
  other: "Другое",
};

const CHANNEL_ALIASES: Record<string, ChatChannel> = {
  whatsapp: "whatsapp",
  wa: "whatsapp",
  wapp: "whatsapp",
  instagram: "instagram",
  ig: "instagram",
  direct: "instagram",
  facebook: "facebook",
  fb: "facebook",
  messenger: "facebook",
  telegram: "telegram",
  tg: "telegram",
};

export function normalizeChannel(raw: unknown): ChatChannel {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return CHANNEL_ALIASES[value] ?? "other";
}

/**
 * Источник лида (leads.source) по каналу переписки.
 * Instagram и Facebook — это Meta: лид из директа должен считаться вместе
 * с лидами рекламы Meta, иначе цена лида в отчётах поедет.
 */
export function channelToLeadSource(channel: ChatChannel): string {
  if (channel === "whatsapp") return "whatsapp";
  if (channel === "instagram" || channel === "facebook") return "meta";
  return "other";
}

/* ------------------------------- телефон -------------------------------- */

/** Короче десяти цифр номера не бывает, длиннее пятнадцати — уже не номер (E.164). */
const MIN_DIGITS = 10;
const MAX_DIGITS = 15;

/** Цифры вперемешку с разделителями, которыми люди разбивают номер. */
const PHONE_CANDIDATE = /\+?\d[\d\s\-().]{8,20}\d/g;

/**
 * Приводит номер к виду +7XXXXXXXXXX.
 * Мы работаем в Казахстане, поэтому 10 цифр без кода и «8» в начале
 * трактуем как местный номер. Всё остальное оставляем как прислали.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null;

  if (digits.length === 10) return `+7${digits}`;
  if (digits.length === 11 && (digits.startsWith("8") || digits.startsWith("7"))) {
    return `+7${digits.slice(1)}`;
  }
  return `+${digits}`;
}

/**
 * Ищет номер в тексте сообщения.
 * Именно на этом держится весь раздел: человек написал «мой номер 87011234567» —
 * и переписка становится лидом.
 */
export function extractPhone(text: string | null | undefined): string | null {
  if (!text) return null;
  for (const candidate of text.match(PHONE_CANDIDATE) ?? []) {
    const phone = normalizePhone(candidate);
    if (phone) return phone;
  }
  return null;
}

/* -------------------------------- событие -------------------------------- */

const MAX_NAME = 200;
const MAX_BODY = 2000;
const MAX_ID = 200;

/**
 * Объявление, из которого человек написал.
 *
 * Meta прикладывает блок `referral` к первому сообщению после клика по рекламе
 * с кнопкой «Написать в WhatsApp». Там лежит `source_id` — это ID объявления,
 * тот же, что в рекламном кабинете. Никаких UTM-меток для этого не нужно.
 */
export type ChatReferral = {
  adExternalId: string;
  headline: string | null;
};

export type ChatEvent = {
  externalId: string;
  channel: ChatChannel;
  contactName: string | null;
  /** Телефон из полей события — он надёжнее вытащенного из текста. */
  contactPhone: string | null;
  body: string | null;
  direction: "in" | "out";
  /** Откуда пришёл человек; null — если писал не из рекламы. */
  referral: ChatReferral | null;
};

export type ChatParseResult =
  | { ok: true; event: ChatEvent }
  | { ok: false; error: string };

function readString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

/** У ChatPlace текст лежит то строкой, то объектом `message: { text }`. */
function readBody(source: Record<string, unknown>): string | null {
  const direct = readString(source, ["text", "body", "content", "message_text"]);
  if (direct) return direct;

  const message = source.message;
  if (typeof message === "string" && message.trim()) return message.trim();
  if (message && typeof message === "object" && !Array.isArray(message)) {
    return readString(message as Record<string, unknown>, ["text", "body", "content"]);
  }
  return null;
}

/**
 * Где может лежать блок про рекламу.
 * У WhatsApp Cloud API это `referral` внутри сообщения, но посредники вроде
 * ChatPlace часто разворачивают вложенность или переименовывают поле, поэтому
 * ищем в нескольких местах и на верхнем уровне тоже.
 */
const REFERRAL_CONTAINERS = ["referral", "ad_referral", "referral_data", "ctwa", "context"];
const AD_ID_KEYS = ["source_id", "ad_id", "adId", "ad_external_id", "source_ad_id"];
const HEADLINE_KEYS = ["headline", "ad_headline", "title"];

function pickObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Достаёт объявление из события.
 *
 * `source_type` важен: по клику из обычного поста Meta тоже присылает referral,
 * но `source_id` там — идентификатор поста, а не объявления. Такое к рекламе
 * не привязываем, иначе в аналитике креативов появятся выдуманные строки.
 */
function readReferral(source: Record<string, unknown>): ChatReferral | null {
  const candidates: Record<string, unknown>[] = [];
  for (const key of REFERRAL_CONTAINERS) {
    const nested = pickObject(source[key]);
    if (nested) {
      candidates.push(nested);
      const deeper = pickObject(nested.referral);
      if (deeper) candidates.push(deeper);
    }
  }
  // Верхний уровень пробуем последним: там поля могли просто разложить плоско.
  candidates.push(source);

  for (const candidate of candidates) {
    const adExternalId = readString(candidate, AD_ID_KEYS);
    if (!adExternalId) continue;

    const sourceType = readString(candidate, ["source_type", "referral_type"])?.toLowerCase();
    if (sourceType && sourceType !== "ad") continue;

    return {
      adExternalId: adExternalId.slice(0, MAX_ID),
      headline: readString(candidate, HEADLINE_KEYS)?.slice(0, MAX_NAME) ?? null,
    };
  }

  return null;
}

const OUTGOING = new Set(["out", "outgoing", "outbound", "bot", "operator", "manager"]);

function readDirection(source: Record<string, unknown>): "in" | "out" {
  const raw = readString(source, ["direction", "from", "sender", "type"])?.toLowerCase();
  return raw && OUTGOING.has(raw) ? "out" : "in";
}

export function parseChatEvent(body: unknown): ChatParseResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Ожидался объект JSON." };
  }

  const source = body as Record<string, unknown>;

  // Переписку надо чем-то опознать: без идентификатора каждое сообщение
  // станет новым диалогом, и раздел превратится в свалку.
  const externalId = readString(source, [
    "chat_id",
    "conversation_id",
    "dialog_id",
    "subscriber_id",
    "user_id",
    "contact_id",
    "id",
  ]);
  if (!externalId) {
    return { ok: false, error: "Нет идентификатора переписки (chat_id)." };
  }

  const contactName = readString(source, [
    "name",
    "full_name",
    "contact_name",
    "first_name",
    "username",
  ]);
  const rawPhone = readString(source, ["phone", "contact_phone", "tel", "телефон"]);

  return {
    ok: true,
    event: {
      externalId: externalId.slice(0, MAX_ID),
      channel: normalizeChannel(readString(source, ["channel", "platform", "messenger", "source"])),
      contactName: contactName ? contactName.slice(0, MAX_NAME) : null,
      contactPhone: rawPhone ? normalizePhone(rawPhone) : null,
      body: readBody(source)?.slice(0, MAX_BODY) ?? null,
      direction: readDirection(source),
      referral: readReferral(source),
    },
  };
}
