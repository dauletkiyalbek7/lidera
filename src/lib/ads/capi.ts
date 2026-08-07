import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { readIntegrationCredentialsAsPlatform } from "@/lib/queries/integrations";
import type { Database } from "@/lib/database.types";

/**
 * Conversions API: событие покупки в рекламный кабинет Meta (ТЗ, Блок 3).
 *
 * Поток: продажник прислал чек боту → бот подтвердил продажу → отсюда уходит
 * событие Purchase. Атрибуцию к объявлению Meta делает сама, сопоставляя клиента
 * по хешу телефона (advanced matching), поэтому телефон обязателен, а наш
 * creative_id в Meta не шлём — он для нашей аналитики.
 *
 * Токен кабинета живёт только на сервере (зашифрован), в браузер не уходит.
 */

const GRAPH = "https://graph.facebook.com/v21.0";
/** Meta должна ответить быстро — вебхук бота не может ждать долго. */
const TIMEOUT_MS = 4000;

type Admin = SupabaseClient<Database>;

export type CapiStatus = "sent" | "failed" | "skipped";
export type CapiResult = { status: CapiStatus; reason: string | null };

export type PurchaseInput = {
  projectId: string;
  /** id продажи — он же event_id для дедупликации на стороне Meta. */
  saleId: string;
  amount: number;
  currency: string;
  phone: string | null;
  /** Время события, unix-секунды. По умолчанию — сейчас. */
  eventTime?: number;
};

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Телефон для Meta: только цифры с кодом страны, затем sha256. */
function hashPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return sha256Hex(digits);
}

/** Pixel (dataset) id хранится в несекретном config интеграции meta. */
async function readPixelId(admin: Admin, projectId: string): Promise<string | null> {
  const { data } = await admin
    .from("integrations")
    .select("config")
    .eq("project_id", projectId)
    .eq("provider", "meta")
    .maybeSingle();

  const config = data?.config;
  if (!config || typeof config !== "object") return null;
  const pixelId = (config as Record<string, unknown>).pixel_id;
  return typeof pixelId === "string" && pixelId ? pixelId : null;
}

/**
 * Шлёт Purchase в Meta CAPI. Никогда не бросает — возвращает статус, чтобы
 * подтверждение чека ботом не падало из-за рекламного кабинета.
 */
export async function sendPurchaseToMeta(
  admin: Admin,
  input: PurchaseInput,
): Promise<CapiResult> {
  const phoneHash = input.phone ? hashPhone(input.phone) : null;
  if (!phoneHash) {
    return { status: "skipped", reason: "Нет телефона клиента для сопоставления в Meta." };
  }

  const credentials = await readIntegrationCredentialsAsPlatform(input.projectId, "meta");
  if (!credentials) {
    return { status: "skipped", reason: "Meta Ads не подключена или ключ недоступен." };
  }

  const pixelId = await readPixelId(admin, input.projectId);
  if (!pixelId) {
    return { status: "skipped", reason: "В интеграции Meta не задан Pixel ID (dataset)." };
  }

  const body = {
    data: [
      {
        event_name: "Purchase",
        event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
        action_source: "system_generated",
        event_id: input.saleId,
        user_data: { ph: [phoneHash] },
        custom_data: { currency: input.currency, value: input.amount },
      },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${GRAPH}/${pixelId}/events?access_token=${encodeURIComponent(credentials.token)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: controller.signal,
      },
    );

    const json = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };

    if (!res.ok) {
      const message = json.error?.message ?? `HTTP ${res.status}`;
      return { status: "failed", reason: message.slice(0, 300) };
    }
    return { status: "sent", reason: null };
  } catch {
    return { status: "failed", reason: "Meta не ответила вовремя." };
  } finally {
    clearTimeout(timer);
  }
}
