import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { AmoApiError, fetchAmoContacts, fetchAmoLeads } from "@/lib/amocrm";

/**
 * Импорт сделок amoCRM в наши Лиды, Продажи и Клиенты (ТЗ, Блок 4).
 *
 * Сделка клиента появляется в воронке (выигранная → этап «продажа»); из
 * выигранных сделок заводим Продажу и Клиента (LTV) — так из amoCRM едут деньги
 * и становится доступен CAPI по ним.
 *
 * Идемпотентно везде: узнаём запись по external_source='amocrm' + external_id
 * (сделка → лид/продажа, контакт → клиент) и обновляем её, а не плодим дубли.
 * Метрики дня не трогаем — источник правды по продажам это сами таблицы, иначе
 * при повторной синхронизации деньги задвоятся. Пишем сервисным ключом.
 */

export type AmoSyncResult = { error: string | null; message: string | null };

const CHUNK = 500;
const SOURCE = "amocrm";

type LeadUpsert = Database["public"]["Tables"]["leads"]["Insert"];
type CustomerUpsert = Database["public"]["Tables"]["customers"]["Insert"];
type SaleUpsert = Database["public"]["Tables"]["sales"]["Insert"];

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

  const leadName = (lead: (typeof active)[number]) => {
    const contact = lead.mainContactId ? contacts.get(lead.mainContactId) : null;
    return lead.name || contact?.name || contact?.phone || `Сделка #${lead.id}`;
  };

  const leadRows: LeadUpsert[] = active.map((lead) => {
    const contact = lead.mainContactId ? contacts.get(lead.mainContactId) : null;
    return {
      project_id: projectId,
      external_source: SOURCE,
      external_id: String(lead.id),
      full_name: leadName(lead),
      phone: contact?.phone ?? null,
      source: SOURCE,
      status: lead.won ? "sale" : "new",
      value: lead.price,
    };
  });

  let imported = 0;
  for (let i = 0; i < leadRows.length; i += CHUNK) {
    const chunk = leadRows.slice(i, i + CHUNK);
    const { error } = await admin
      .from("leads")
      .upsert(chunk, { onConflict: "project_id,external_source,external_id" });
    if (error) return { error: `Не удалось сохранить сделки: ${error.message}`, message: null };
    imported += chunk.length;
  }

  const won = active.filter((lead) => lead.won);

  // Клиенты: один контакт amoCRM — один наш клиент. LTV = сумма его выигранных
  // сделок; дата первой покупки — самая ранняя. Пересчитываем целиком, поэтому
  // повторная синхронизация не задваивает суммы.
  const byContact = new Map<
    number,
    { total: number; firstAt: string | null; name: string; phone: string | null }
  >();
  for (const lead of won) {
    if (!lead.mainContactId) continue;
    const contact = contacts.get(lead.mainContactId);
    const current = byContact.get(lead.mainContactId) ?? {
      total: 0,
      firstAt: null,
      name: contact?.name || contact?.phone || leadName(lead),
      phone: contact?.phone ?? null,
    };
    current.total += lead.price;
    if (lead.createdAt && (!current.firstAt || lead.createdAt < current.firstAt)) {
      current.firstAt = lead.createdAt;
    }
    byContact.set(lead.mainContactId, current);
  }

  const customerRows: CustomerUpsert[] = [...byContact.entries()].map(([contactId, c]) => ({
    project_id: projectId,
    external_source: SOURCE,
    external_id: String(contactId),
    full_name: c.name,
    phone: c.phone,
    total_spent: c.total,
    first_purchase_at: c.firstAt,
  }));

  for (let i = 0; i < customerRows.length; i += CHUNK) {
    const chunk = customerRows.slice(i, i + CHUNK);
    const { error } = await admin
      .from("customers")
      .upsert(chunk, { onConflict: "project_id,external_source,external_id" });
    if (error) return { error: `Не удалось сохранить клиентов: ${error.message}`, message: null };
  }

  // Связки внешний id → наш id, чтобы у продажи были lead_id и customer_id.
  const leadIdByExternal = new Map<string, string>();
  const storedLeads = await admin
    .from("leads")
    .select("id, external_id")
    .eq("project_id", projectId)
    .eq("external_source", SOURCE);
  for (const row of storedLeads.data ?? []) {
    if (row.external_id) leadIdByExternal.set(row.external_id, row.id);
  }

  const customerIdByExternal = new Map<string, string>();
  const storedCustomers = await admin
    .from("customers")
    .select("id, external_id")
    .eq("project_id", projectId)
    .eq("external_source", SOURCE);
  for (const row of storedCustomers.data ?? []) {
    if (row.external_id) customerIdByExternal.set(row.external_id, row.id);
  }

  // Продажи из выигранных сделок. capi_status='pending' — отправку в Meta по-прежнему
  // решает человек (кнопка/бот), автоматически из импорта в рекламу не шлём.
  const saleRows: SaleUpsert[] = won.map((lead) => ({
    project_id: projectId,
    external_source: SOURCE,
    external_id: String(lead.id),
    lead_id: leadIdByExternal.get(String(lead.id)) ?? null,
    customer_id: lead.mainContactId
      ? (customerIdByExternal.get(String(lead.mainContactId)) ?? null)
      : null,
    product: lead.name || "Сделка amoCRM",
    amount: lead.price,
    created_at: lead.createdAt ?? undefined,
  }));

  for (let i = 0; i < saleRows.length; i += CHUNK) {
    const chunk = saleRows.slice(i, i + CHUNK);
    const { error } = await admin
      .from("sales")
      .upsert(chunk, { onConflict: "project_id,external_source,external_id" });
    if (error) return { error: `Не удалось сохранить продажи: ${error.message}`, message: null };
  }

  await admin.from("activity_log").insert({
    project_id: projectId,
    actor_id: null,
    action: "amocrm.synced",
    details: {
      leads: imported,
      won: won.length,
      customers: customerRows.length,
      contacts: contacts.size,
    },
  });

  return {
    error: null,
    message:
      `Импортировано сделок: ${imported} (выигранных: ${won.length}). ` +
      `Клиентов: ${customerRows.length}. Продаж: ${saleRows.length}.`,
  };
}
