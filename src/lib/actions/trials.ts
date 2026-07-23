"use server";

import { revalidatePath } from "next/cache";

import type { SupabaseClient } from "@supabase/supabase-js";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assignTrial } from "@/lib/leads/assign";
import { notifyLeadWon, notifyTrialAssigned } from "@/lib/notify";
import { formatDateTime, formatMoney, parseLocalDateTime } from "@/lib/format";
import { today } from "@/lib/date-range";
import { hasServiceRoleKey } from "@/lib/queries/employees";
import type { Database } from "@/lib/database.types";

/**
 * Пробный урок: передача продажнику (ТЗ, Блок 2).
 *
 * Менеджер продал пробный (990 ₸) и назначил дату/время — лид уходит в очередь
 * продажнику по кругу. Продажник проводит урок и отмечает «проведён». Пишем
 * сервисным ключом: у роли нет своей RLS-политики на запись, право проверяем в
 * коде — менеджер только свой лид, продажник только свой пробный, руководители все.
 */

export type TrialState = { message: string | null; error: string | null };

const EMPTY: TrialState = { message: null, error: null };

/** Может ли роль действовать за любого (не только за свой лид). */
function isOverseer(role: string, canManage: boolean): boolean {
  return canManage || role === "director" || role === "rop";
}

/**
 * Менеджер записывает лид на пробный: отмечает оплату 990 ₸ и дату/время,
 * лид уходит продажнику на смене по кругу.
 */
export async function bookTrial(
  _prev: TrialState,
  formData: FormData,
): Promise<TrialState> {
  const projectId = String(formData.get("project_id") ?? "");
  const leadId = String(formData.get("lead_id") ?? "");
  const whenRaw = String(formData.get("trial_at") ?? "");

  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!hasServiceRoleKey()) {
    return { message: null, error: "На сервере не задан ключ для записи на пробный." };
  }

  const trialAt = parseLocalDateTime(whenRaw);
  if (!trialAt) {
    return { message: null, error: "Укажите дату и время пробного урока." };
  }

  const admin = createSupabaseAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("id, full_name, phone, status, assigned_to")
    .eq("id", leadId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!lead) return { message: null, error: "Лид не найден." };

  // Записывает ответственный менеджер лида или руководитель.
  const mayBook = isOverseer(role, canManage) || lead.assigned_to === user.id;
  if (!mayBook) {
    return { message: null, error: "Записать на пробный может ответственный менеджер." };
  }
  if (lead.status === "trial_booked" || lead.status === "trial_done" || lead.status === "sale") {
    return { message: null, error: "Этот лид уже на пробном или дальше по воронке." };
  }

  const { error: updateError } = await admin
    .from("leads")
    .update({ status: "trial_booked", trial_at: trialAt, trial_paid_at: new Date().toISOString() })
    .eq("id", leadId)
    .eq("project_id", projectId);
  if (updateError) {
    return { message: null, error: "Не удалось записать на пробный." };
  }

  // Раздача продажнику по кругу — после смены статуса, чтобы очередь считалась верно.
  const salespersonId = await assignTrial(admin, projectId, leadId);

  await admin.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "trial.booked",
    details: { lead_id: leadId, trial_at: trialAt, salesperson_id: salespersonId },
  });

  await notifyTrialAssigned(admin, projectId, {
    fullName: lead.full_name,
    phone: lead.phone,
    salespersonId,
    when: formatDateTime(trialAt),
  });

  revalidatePath(`/p/${projectId}/leads`);
  revalidatePath(`/p/${projectId}/trial-lessons`);
  revalidatePath(`/p/${projectId}/salesperson-office`);

  return {
    message: salespersonId
      ? `Записан на пробный (${formatDateTime(trialAt)}), назначен продажнику.`
      : `Записан на пробный (${formatDateTime(trialAt)}). Свободного продажника нет — ждёт очереди.`,
    error: null,
  };
}

type Admin = SupabaseClient<Database>;

/**
 * Клиент купившего лида: связываем продажу с клиентом и копим LTV (total_spent).
 * Ищем по телефону в рамках проекта; нет — заводим нового. Уникального ключа на
 * телефон нет, поэтому берём первого совпавшего, а не maybeSingle (не падаем на дублях).
 */
async function upsertCustomer(
  admin: Admin,
  projectId: string,
  fullName: string,
  phone: string | null,
  amount: number,
): Promise<string | null> {
  const nowIso = new Date().toISOString();

  if (phone) {
    const { data: found } = await admin
      .from("customers")
      .select("id, total_spent, first_purchase_at")
      .eq("project_id", projectId)
      .eq("phone", phone)
      .order("created_at", { ascending: true })
      .limit(1);
    const existing = found?.[0];
    if (existing) {
      await admin
        .from("customers")
        .update({
          total_spent: Number(existing.total_spent) + amount,
          first_purchase_at: existing.first_purchase_at ?? nowIso,
        })
        .eq("id", existing.id);
      return existing.id;
    }
  }

  const { data: created } = await admin
    .from("customers")
    .insert({
      project_id: projectId,
      full_name: fullName,
      phone,
      first_purchase_at: nowIso,
      total_spent: amount,
    })
    .select("id")
    .single();
  return created?.id ?? null;
}

/**
 * Продажник закрывает продажу курса: создаёт настоящую строку продажи, клиента
 * (LTV) и кладёт день в metrics_daily, чтобы дашборд увидел выручку. Чек продажник
 * пришлёт боту отдельно — продажа создаётся со статусом чека «ожидается».
 */
export async function markCourseSold(
  _prev: TrialState,
  formData: FormData,
): Promise<TrialState> {
  const projectId = String(formData.get("project_id") ?? "");
  const leadId = String(formData.get("lead_id") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").replace(",", ".");
  const product = String(formData.get("product") ?? "").trim() || "Курс";

  const { project, role, canManage, user } = await requireProjectContext(projectId);
  if (!hasServiceRoleKey()) {
    return { message: null, error: "На сервере не задан ключ для продажи." };
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { message: null, error: "Укажите сумму продажи курса." };
  }

  const admin = createSupabaseAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("id, full_name, phone, status, salesperson_id, assigned_to")
    .eq("id", leadId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!lead) return { message: null, error: "Лид не найден." };

  const maySell = isOverseer(role, canManage) || lead.salesperson_id === user.id;
  if (!maySell) {
    return { message: null, error: "Отметить продажу может назначенный продажник." };
  }
  if (lead.status === "sale") {
    return { message: null, error: "Курс по этому лиду уже продан." };
  }
  if (lead.status !== "trial_booked" && lead.status !== "trial_done") {
    return { message: null, error: "Сначала запишите и проведите пробный урок." };
  }

  const sellerId = lead.salesperson_id ?? user.id;
  const customerId = await upsertCustomer(admin, projectId, lead.full_name, lead.phone, amount);

  const { error: saleError } = await admin.from("sales").insert({
    project_id: projectId,
    lead_id: leadId,
    customer_id: customerId,
    seller_id: sellerId,
    product,
    amount,
    receipt_status: "awaiting",
  });
  if (saleError) {
    return { message: null, error: "Не удалось сохранить продажу." };
  }

  await admin.from("leads").update({ status: "sale" }).eq("id", leadId).eq("project_id", projectId);

  // Выручку дня — в metrics_daily, чтобы её увидели Главная и Продажи.
  await admin.rpc("record_daily_sale", {
    p_project: projectId,
    p_date: today(),
    p_amount: amount,
  });

  await admin.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "sale.created",
    details: { lead_id: leadId, amount, product },
  });

  await notifyLeadWon(admin, projectId, {
    fullName: lead.full_name,
    assignedTo: lead.assigned_to,
  });

  revalidatePath(`/p/${projectId}/sales`);
  revalidatePath(`/p/${projectId}/salesperson-office`);
  revalidatePath(`/p/${projectId}/customers`);
  revalidatePath(`/p/${projectId}/leads`);
  revalidatePath(`/p/${projectId}/trial-lessons`);
  revalidatePath(`/p/${projectId}`);

  return {
    message: `Курс продан на ${formatMoney(amount, project.currency)}. Пришлите чек боту для подтверждения.`,
    error: null,
  };
}

/** Продажник отмечает «пробный проведён»: следующий шаг — продажа курса (Этап 3). */
export async function markTrialDone(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const leadId = String(formData.get("lead_id") ?? "");

  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!hasServiceRoleKey()) return;

  const admin = createSupabaseAdminClient();
  const { data: lead } = await admin
    .from("leads")
    .select("id, status, salesperson_id")
    .eq("id", leadId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!lead || lead.status !== "trial_booked") return;

  // Отмечает назначенный продажник или руководитель.
  const mayMark = isOverseer(role, canManage) || lead.salesperson_id === user.id;
  if (!mayMark) return;

  await admin
    .from("leads")
    .update({ status: "trial_done" })
    .eq("id", leadId)
    .eq("project_id", projectId);

  await admin.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "trial.done",
    details: { lead_id: leadId },
  });

  revalidatePath(`/p/${projectId}/trial-lessons`);
  revalidatePath(`/p/${projectId}/salesperson-office`);
  revalidatePath(`/p/${projectId}/leads`);
}
