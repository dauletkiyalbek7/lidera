import "server-only";

/**
 * amoCRM — подключение чужой CRM клиента (ТЗ, Блок 4).
 * Первый шаг — только связь: проверяем, что домен и долгосрочный токен доступа
 * рабочие. Данные (сделки, звонки) импортируем следующим этапом.
 *
 * Токен живёт только на сервере (зашифрован), в браузер не уходит.
 */

const TIMEOUT_MS = 6000;

/** Приводим адрес к чистому домену: без https://, без пути и лишних пробелов. */
export function normalizeAmoDomain(raw: string): string {
  return raw
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .toLowerCase();
}

/** amoCRM (и Kommo) живут на этих доменах — грубая проверка, чтобы не бить наугад. */
function looksLikeAmoDomain(domain: string): boolean {
  return /\.(amocrm\.(ru|com)|kommo\.com)$/.test(domain);
}

export type AmoVerifyResult = { ok: boolean; name?: string; error?: string };

/**
 * Проверяет доступ: GET /api/v4/account с Bearer-токеном.
 * Возвращает имя аккаунта при успехе или понятную причину отказа.
 */
export async function verifyAmoCrmAccess(
  rawDomain: string,
  token: string,
): Promise<AmoVerifyResult> {
  const domain = normalizeAmoDomain(rawDomain);
  if (!domain) return { ok: false, error: "Укажите адрес аккаунта, например mycompany.amocrm.ru" };
  if (!looksLikeAmoDomain(domain)) {
    return { ok: false, error: "Адрес похож на неверный. Ожидается вида mycompany.amocrm.ru" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://${domain}/api/v4/account`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    });

    if (res.status === 401) {
      return { ok: false, error: "Токен не принят (401). Проверьте долгосрочный токен доступа." };
    }
    if (!res.ok) {
      return { ok: false, error: `amoCRM ответила ${res.status}. Проверьте адрес и токен.` };
    }

    const json = (await res.json().catch(() => ({}))) as { name?: string };
    return { ok: true, name: json.name ?? domain };
  } catch {
    return { ok: false, error: "amoCRM не ответила. Проверьте адрес и токен." };
  } finally {
    clearTimeout(timer);
  }
}

/* ----------------------------- Чтение данных ----------------------------- */

export class AmoApiError extends Error {}

/** amoCRM статус выигранной/проигранной сделки — глобальные id во всех аккаунтах. */
const WON_STATUS_ID = 142;
const LOST_STATUS_ID = 143;
const PAGE_LIMIT = 250;
/** Предохранитель: не уходим в бесконечную выкачку. */
const MAX_PAGES = 60;

async function amoGet(
  domain: string,
  token: string,
  path: string,
): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://${domain}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: controller.signal,
    });
    // 204 — данных на странице больше нет: штатное завершение пагинации.
    if (res.status === 204) return null;
    if (!res.ok) throw new AmoApiError(`amoCRM ответила ${res.status}`);
    return (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } catch (error) {
    if (error instanceof AmoApiError) throw error;
    throw new AmoApiError("amoCRM не ответила вовремя");
  } finally {
    clearTimeout(timer);
  }
}

export type AmoContact = { id: number; name: string | null; phone: string | null };

/** Телефон контакта из custom_fields_values (поле с кодом PHONE). */
function readContactPhone(contact: Record<string, unknown>): string | null {
  const fields = contact.custom_fields_values;
  if (!Array.isArray(fields)) return null;
  for (const field of fields) {
    const f = field as { field_code?: string; field_type?: string; values?: { value?: unknown }[] };
    if (f.field_code === "PHONE" || f.field_type === "phone") {
      const value = f.values?.[0]?.value;
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return null;
}

/** Все контакты аккаунта в карту id → {имя, телефон}. */
export async function fetchAmoContacts(
  domain: string,
  token: string,
): Promise<Map<number, AmoContact>> {
  const map = new Map<number, AmoContact>();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const json = await amoGet(domain, token, `/api/v4/contacts?limit=${PAGE_LIMIT}&page=${page}`);
    const rows = (json?._embedded as { contacts?: Record<string, unknown>[] } | undefined)?.contacts;
    if (!rows || rows.length === 0) break;
    for (const row of rows) {
      const id = Number(row.id);
      map.set(id, {
        id,
        name: typeof row.name === "string" ? row.name : null,
        phone: readContactPhone(row),
      });
    }
    if (rows.length < PAGE_LIMIT) break;
  }
  return map;
}

export type AmoLead = {
  id: number;
  name: string | null;
  price: number;
  statusId: number;
  won: boolean;
  lost: boolean;
  mainContactId: number | null;
  createdAt: string | null;
};

/** Все сделки аккаунта с id главного контакта. */
export async function fetchAmoLeads(domain: string, token: string): Promise<AmoLead[]> {
  const leads: AmoLead[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const json = await amoGet(
      domain,
      token,
      `/api/v4/leads?limit=${PAGE_LIMIT}&page=${page}&with=contacts`,
    );
    const rows = (json?._embedded as { leads?: Record<string, unknown>[] } | undefined)?.leads;
    if (!rows || rows.length === 0) break;
    for (const row of rows) {
      const contacts = (row._embedded as { contacts?: { id: number; is_main?: boolean }[] } | undefined)
        ?.contacts;
      const main = contacts?.find((c) => c.is_main) ?? contacts?.[0] ?? null;
      const statusId = Number(row.status_id);
      const createdUnix = Number(row.created_at);
      leads.push({
        id: Number(row.id),
        name: typeof row.name === "string" ? row.name : null,
        price: Number(row.price) || 0,
        statusId,
        won: statusId === WON_STATUS_ID,
        lost: statusId === LOST_STATUS_ID,
        mainContactId: main ? Number(main.id) : null,
        createdAt: Number.isFinite(createdUnix) ? new Date(createdUnix * 1000).toISOString() : null,
      });
    }
    if (rows.length < PAGE_LIMIT) break;
  }
  return leads;
}
