"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { LEAD_STATUS_FLOW } from "@/lib/domain";
import { assignIncomingLead } from "@/lib/leads/assign";
import { normalizeSource } from "@/lib/intake";
import { notifyLeadWon } from "@/lib/notify";
import { hasServiceRoleKey } from "@/lib/queries/employees";

export type CreateLeadState = { message: string | null; error: string | null };

/** Кто может завести лид руками: руководители и менеджеры (свой лид). */
function mayCreateLead(role: string, canManage: boolean): boolean {
  return canManage || role === "director" || role === "rop" || role === "manager";
}

/**
 * Ручное заведение лида (WhatsApp без чат-бота, ТЗ Блок 2).
 * Менеджер видит метку креатива в первом сообщении (её ставят в текст рекламы
 * click-to-WhatsApp) и выбирает креатив из списка — так заявка сразу привязана,
 * а позже чек унаследует креатив. Пишем сервисным ключом: у менеджера нет своей
 * RLS-политики на запись, право проверяем в коде.
 */
export async function createLead(
  _prev: CreateLeadState,
  formData: FormData,
): Promise<CreateLeadState> {
  const projectId = String(formData.get("project_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const creativeId = String(formData.get("creative_id") ?? "").trim() || null;
  const source = normalizeSource(String(formData.get("source") ?? "whatsapp"));

  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!mayCreateLead(role, canManage)) {
    return { message: null, error: "Заводить лиды может менеджер или руководитель." };
  }
  if (!hasServiceRoleKey()) {
    return { message: null, error: "На сервере не задан ключ для записи лида." };
  }
  if (!fullName && !phone) {
    return { message: null, error: "Укажите имя или телефон." };
  }

  const admin = createSupabaseAdminClient();

  // Креатив должен принадлежать проекту — чужой id не привяжем.
  if (creativeId) {
    const { data: creative } = await admin
      .from("creatives")
      .select("id")
      .eq("project_id", projectId)
      .eq("id", creativeId)
      .maybeSingle();
    if (!creative) {
      return { message: null, error: "Выбранный креатив не найден." };
    }
  }

  const { data: lead, error } = await admin
    .from("leads")
    .insert({
      project_id: projectId,
      full_name: fullName || phone,
      phone: phone || null,
      source,
      status: "new",
      creative_id: creativeId,
    })
    .select("id")
    .single();

  if (error || !lead) {
    return { message: null, error: "Не удалось сохранить лид." };
  }

  // Менеджер берёт свой лид себе; руководитель — раздаёт по кругу на смене.
  if (role === "manager") {
    await admin.from("leads").update({ assigned_to: user.id }).eq("id", lead.id);
  } else {
    await assignIncomingLead(admin, projectId, lead.id);
  }

  await admin.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "lead.created_manual",
    details: { lead_id: lead.id, source, creative_id: creativeId },
  });

  revalidatePath(`/p/${projectId}/leads`);
  revalidatePath(`/p/${projectId}/crm-funnel`);

  return { message: "Лид добавлен.", error: null };
}

/**
 * Перетаскивание лида между этапами на CRM-воронке (канбан).
 * Право у руководителей (владелец/директор/РОП). Пишем сервисным ключом —
 * у роли может не быть своей RLS-политики на запись, право проверяем в коде.
 * Меняет только статус: настоящие пробные/продажи создаются своими экранами.
 */
export async function moveLeadStage(
  projectId: string,
  leadId: string,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  const { niche, role, canManage, user } = await requireProjectContext(projectId);
  const maySupervise = canManage || role === "director" || role === "rop";
  if (!maySupervise) return { ok: false, error: "Перемещать лиды может руководитель." };
  if (!LEAD_STATUS_FLOW[niche].includes(status)) return { ok: false, error: "Неизвестный этап." };
  if (!hasServiceRoleKey()) return { ok: false, error: "Нет ключа для записи." };

  const admin = createSupabaseAdminClient();
  const { data: updated, error } = await admin
    .from("leads")
    .update({ status })
    .eq("id", leadId)
    .eq("project_id", projectId)
    .select("full_name, assigned_to")
    .single();

  if (error || !updated) return { ok: false, error: "Не удалось переместить лид." };

  await admin.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "lead.status_changed",
    details: { lead_id: leadId, status, via: "funnel" },
  });

  if (status === "sale") {
    await notifyLeadWon(admin, projectId, {
      fullName: updated.full_name,
      assignedTo: updated.assigned_to,
    });
  }

  revalidatePath(`/p/${projectId}/crm-funnel`);
  revalidatePath(`/p/${projectId}/leads`);
  return { ok: true };
}

/**
 * Ручной выбор креатива на лиде (ТЗ, Блок 3 — сквозная аналитика).
 * Автопривязка по UTM не всегда возможна (заявка до подключения, тест, WhatsApp),
 * поэтому даём выбрать любое объявление руками. Привязку наследует и продажа лида —
 * иначе выручка не дойдёт до аналитики креативов. Пустой id снимает привязку.
 */
export async function setLeadCreative(
  projectId: string,
  leadId: string,
  creativeId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!mayCreateLead(role, canManage)) {
    return { ok: false, error: "Менять привязку креатива может менеджер или руководитель." };
  }
  if (!hasServiceRoleKey()) return { ok: false, error: "Нет ключа для записи." };

  const admin = createSupabaseAdminClient();
  const cleanId = creativeId?.trim() || null;

  // Чужой креатив не привяжем — только объявления этого проекта.
  if (cleanId) {
    const { data: creative } = await admin
      .from("creatives")
      .select("id")
      .eq("project_id", projectId)
      .eq("id", cleanId)
      .maybeSingle();
    if (!creative) return { ok: false, error: "Выбранный креатив не найден." };
  }

  const { error } = await admin
    .from("leads")
    .update({ creative_id: cleanId })
    .eq("id", leadId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: "Не удалось сохранить привязку." };

  // Продажи этого лида наследуют выбранный креатив — ради сквозной аналитики.
  await admin
    .from("sales")
    .update({ creative_id: cleanId })
    .eq("project_id", projectId)
    .eq("lead_id", leadId);

  await admin.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "lead.creative_set",
    details: { lead_id: leadId, creative_id: cleanId },
  });

  revalidatePath(`/p/${projectId}/leads`);
  revalidatePath(`/p/${projectId}/crm-funnel`);
  revalidatePath(`/p/${projectId}/creatives-analytics`);
  revalidatePath(`/p/${projectId}/sales`);
  return { ok: true };
}

/**
 * Смена этапа лида. Пока доступна владельцу проекта:
 * точечные права менеджера и продажника добавим вместе с правами доступа (Этап 5).
 */
export async function updateLeadStatus(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const leadId = String(formData.get("lead_id") ?? "");
  const status = String(formData.get("status") ?? "");

  const { niche, canManage, user } = await requireProjectContext(projectId);
  if (!canManage) return;
  if (!LEAD_STATUS_FLOW[niche].includes(status)) return;

  const supabase = await createSupabaseServerClient();
  const { data: updated, error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", leadId)
    .eq("project_id", projectId)
    .select("full_name, assigned_to")
    .single();

  if (error || !updated) return;

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "lead.status_changed",
    details: { lead_id: leadId, status },
  });

  // Лид дошёл до покупки — событие, ради которого и держат бота.
  if (status === "sale" && hasServiceRoleKey()) {
    await notifyLeadWon(createSupabaseAdminClient(), projectId, {
      fullName: updated.full_name,
      assignedTo: updated.assigned_to,
    });
  }

  revalidatePath(`/p/${projectId}/leads`);
  revalidatePath(`/p/${projectId}/crm-funnel`);
}
