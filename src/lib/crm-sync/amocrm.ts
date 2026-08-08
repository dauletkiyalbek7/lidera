import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { AmoApiError, fetchAmoContacts, fetchAmoLeads } from "@/lib/amocrm";

/**
 * Импорт сделок amoCRM в наши Лиды (ТЗ, Блок 4).
 *
 * Первый проход — только лиды: сделка клиента появляется в нашей воронке
 * (выигранная → этап «продажа»). Продажи и клиентов из выигранных сделок
 * добавим следующим проходом, когда выверим форму данных на живом аккаунте.
 *
 * Идемпотентно: узнаём сделку по external_source='amocrm' + external_id и
 * обновляем её, а не плодим дубли. Пишем сервисным ключом — вызывающий уже
 * проверил права.
 */

export type AmoSyncResult = { error: string | null; message: string | null };

const CHUNK = 500;

type LeadUpsert = Database["public"]["Tables"]["leads"]["Insert"];

export async function runAmoCrmSync({
  admin,
  projectId,
  domain,
  token,
}: {
  admin: SupabaseClient<Database>;
  projectId: string;
  domain: string;
  token: string;
}): Promise<AmoSyncResult> {
  let contacts;
  let leads;
  try {
    [contacts, leads] = await Promise.all([
      fetchAmoContacts(domain, token),
      fetchAmoLeads(domain, token),
    ]);
  } catch (error) {
    const reason =
      error instanceof AmoApiError ? error.message : "amoCRM не ответила. Попробуйте позже.";
    return { error: reason, message: null };
  }

  // Проигранные сделки в воронку не тащим — это не активные лиды.
  const active = leads.filter((lead) => !lead.lost);

  const rows: LeadUpsert[] = active.map((lead) => {
    const contact = lead.mainContactId ? contacts.get(lead.mainContactId) : null;
    const fullName = lead.name || contact?.name || contact?.phone || `Сделка #${lead.id}`;
    return {
      project_id: projectId,
      external_source: "amocrm",
      external_id: String(lead.id),
      full_name: fullName,
      phone: contact?.phone ?? null,
      source: "amocrm",
      status: lead.won ? "sale" : "new",
      value: lead.price,
    };
  });

  let imported = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await admin
      .from("leads")
      .upsert(chunk, { onConflict: "project_id,external_source,external_id" });
    if (error) {
      return { error: `Не удалось сохранить сделки: ${error.message}`, message: null };
    }
    imported += chunk.length;
  }

  await admin.from("activity_log").insert({
    project_id: projectId,
    actor_id: null,
    action: "amocrm.synced",
    details: { leads: imported, won: active.filter((l) => l.won).length, contacts: contacts.size },
  });

  const wonCount = active.filter((lead) => lead.won).length;
  return {
    error: null,
    message: `Импортировано сделок: ${imported} (из них выигранных: ${wonCount}). Контактов прочитано: ${contacts.size}.`,
  };
}
