"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assignTrial } from "@/lib/leads/assign";
import { notifyTrialAssigned } from "@/lib/notify";
import { formatDateTime, parseLocalDateTime } from "@/lib/format";
import { hasServiceRoleKey } from "@/lib/queries/employees";

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
