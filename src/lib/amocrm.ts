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
