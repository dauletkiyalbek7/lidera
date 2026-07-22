import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Приём лидов извне (ТЗ, Блок 3).
 * Сайт, лендинг или Tilda шлют заявку с токеном проекта; вместе с ней приходит
 * метка креатива, без которой сквозная аналитика остаётся пустой.
 */

const TOKEN_BYTES = 24;
const HINT_LENGTH = 4;

export function generateIntakeToken(): string {
  return `lid_${randomBytes(TOKEN_BYTES).toString("base64url")}`;
}

/** В базе живёт только отпечаток: утечка таблицы не даёт возможности слать заявки. */
export function hashIntakeToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

export function intakeHint(token: string): string {
  return `…${token.slice(-HINT_LENGTH)}`;
}

/** Источники, которые мы понимаем (ТЗ, раздел 8: leads.source). */
const SOURCE_ALIASES: Record<string, string> = {
  meta: "meta",
  facebook: "meta",
  fb: "meta",
  instagram: "meta",
  ig: "meta",
  tiktok: "tiktok",
  tt: "tiktok",
  whatsapp: "whatsapp",
  wa: "whatsapp",
};

export function normalizeSource(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return SOURCE_ALIASES[value] ?? (value ? "other" : "other");
}

/** Площадка креатива: нужна, чтобы объявление легло к своей рекламной системе. */
export function normalizePlatform(raw: unknown): string | null {
  const source = normalizeSource(raw);
  return source === "meta" || source === "tiktok" ? source : null;
}

const MAX_NAME = 200;
const MAX_PHONE = 40;
const MAX_TAG = 200;

export type IntakePayload = {
  fullName: string;
  phone: string | null;
  source: string;
  /** Идентификатор объявления в кабинете, если пришёл. */
  creativeExternalId: string | null;
  /** Название креатива — им пользуются, когда id нет (например, utm_content). */
  creativeName: string | null;
  platform: string | null;
  value: number;
};

export type IntakeResult =
  | { ok: true; payload: IntakePayload }
  | { ok: false; error: string };

function readString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

/**
 * Разбирает тело запроса.
 * Имена полей принимаем в нескольких вариантах: у Tilda они свои, у лид-форм свои,
 * а у самописных лендингов — какие получится.
 */
export function parseIntakePayload(body: unknown): IntakeResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Ожидался объект JSON." };
  }

  const source = body as Record<string, unknown>;

  const fullName = readString(source, ["full_name", "name", "Name", "имя", "fullname"]);
  const phone = readString(source, ["phone", "Phone", "tel", "telephone", "телефон"]);

  if (!fullName && !phone) {
    return { ok: false, error: "Нужно имя или телефон — иначе это не заявка." };
  }

  const creativeExternalId = readString(source, [
    "creative_id",
    "ad_id",
    "adset_id",
    "utm_term",
  ]);
  const creativeName = readString(source, ["creative", "creative_name", "utm_content"]);

  const rawValue = readString(source, ["value", "amount", "сумма"]);
  const parsedValue = rawValue ? Number(rawValue.replace(",", ".")) : 0;

  return {
    ok: true,
    payload: {
      fullName: (fullName ?? phone ?? "Без имени").slice(0, MAX_NAME),
      phone: phone ? phone.slice(0, MAX_PHONE) : null,
      source: normalizeSource(readString(source, ["source", "utm_source", "platform"])),
      creativeExternalId: creativeExternalId ? creativeExternalId.slice(0, MAX_TAG) : null,
      creativeName: creativeName ? creativeName.slice(0, MAX_TAG) : null,
      platform: normalizePlatform(readString(source, ["source", "utm_source", "platform"])),
      value: Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0,
    },
  };
}
