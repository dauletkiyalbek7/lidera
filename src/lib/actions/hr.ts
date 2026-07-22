"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isIsoDate } from "@/lib/date-range";
import {
  isAttendanceStatus,
  isContractKind,
  isContractStatus,
  WEEKDAYS,
} from "@/lib/hr";
import { isProjectRole } from "@/lib/domain";

export type HrFormState = { error: string | null; saved: boolean };

const MAX_TEXT = 300;
const MAX_MONEY = 1_000_000_000;

/** Табель и график ведут директор и РОП; деньги и договоры — только директор. */
function mayMarkAttendance(role: string, canManage: boolean): boolean {
  return canManage || role === "director" || role === "rop";
}

function mayManageMoney(role: string, canManage: boolean): boolean {
  return canManage || role === "director";
}

function readMoney(formData: FormData, name: string): number {
  const value = Number(String(formData.get(name) ?? "").replace(",", "."));
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(value, MAX_MONEY);
}

/** Проверяет, что сотрудник действительно состоит в этом проекте. */
async function isMemberOfProject(projectId: string, userId: string): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

/** Отметка в табеле: один день — одна запись на сотрудника. */
export async function markAttendance(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const status = String(formData.get("status") ?? "");

  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!mayMarkAttendance(role, canManage)) return;
  if (!isIsoDate(date) || !isAttendanceStatus(status)) return;
  if (!(await isMemberOfProject(projectId, userId))) return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("attendance").upsert(
    { project_id: projectId, user_id: userId, date, status, marked_by: user.id },
    { onConflict: "project_id,user_id,date" },
  );

  if (error) return;

  revalidatePath(`/p/${projectId}/attendance`);
  revalidatePath(`/p/${projectId}/salaries`);
}

/** Смена в недельном графике. Пустое время — считаем выходным. */
export async function setWorkShift(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const userId = String(formData.get("user_id") ?? "");
  const weekday = Number(formData.get("weekday"));

  const { role, canManage } = await requireProjectContext(projectId);
  if (!mayMarkAttendance(role, canManage)) return;
  if (!(WEEKDAYS as readonly number[]).includes(weekday)) return;
  if (!(await isMemberOfProject(projectId, userId))) return;

  const startsAt = String(formData.get("starts_at") ?? "").trim();
  const endsAt = String(formData.get("ends_at") ?? "").trim();
  const isDayoff = !startsAt || !endsAt;

  const supabase = await createSupabaseServerClient();
  await supabase.from("work_shifts").upsert(
    {
      project_id: projectId,
      user_id: userId,
      weekday,
      starts_at: isDayoff ? null : startsAt,
      ends_at: isDayoff ? null : endsAt,
      is_dayoff: isDayoff,
    },
    { onConflict: "project_id,user_id,weekday" },
  );

  revalidatePath(`/p/${projectId}/work-schedule`);
}

/**
 * Правило начисления зарплаты — на роль или точечно на сотрудника.
 * Точечное правило перебивает правило роли.
 */
export async function saveSalaryRule(
  _prevState: HrFormState,
  formData: FormData,
): Promise<HrFormState> {
  const projectId = String(formData.get("project_id") ?? "");
  const { role, canManage, user } = await requireProjectContext(projectId);

  if (!mayManageMoney(role, canManage)) {
    return { error: "Правила зарплаты задаёт владелец или директор проекта.", saved: false };
  }

  const target = String(formData.get("target") ?? "");
  const isRoleRule = target.startsWith("role:");
  const key = target.slice(target.indexOf(":") + 1);

  if (isRoleRule ? !isProjectRole(key) : !(await isMemberOfProject(projectId, key))) {
    return { error: "Не понял, кому назначается правило.", saved: false };
  }

  const percent = Number(String(formData.get("percent_of_sales") ?? "").replace(",", "."));
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return { error: "Процент от продаж должен быть от 0 до 100.", saved: false };
  }

  const row = {
    project_id: projectId,
    role: isRoleRule ? key : null,
    user_id: isRoleRule ? null : key,
    base_salary: readMoney(formData, "base_salary"),
    percent_of_sales: percent,
    per_trial: readMoney(formData, "per_trial"),
    per_qualified_lead: readMoney(formData, "per_qualified_lead"),
  };

  const supabase = await createSupabaseServerClient();

  // Частичный уникальный индекс не годится для onConflict, поэтому ищем строку сами.
  let existing = supabase.from("salary_rules").select("id").eq("project_id", projectId);
  existing = isRoleRule
    ? existing.eq("role", key).is("user_id", null)
    : existing.eq("user_id", key);
  const { data: found } = await existing.maybeSingle();

  const { error } = found
    ? await supabase.from("salary_rules").update(row).eq("id", found.id)
    : await supabase.from("salary_rules").insert(row);

  if (error) {
    return { error: "Не удалось сохранить правило. Попробуйте ещё раз.", saved: false };
  }

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "salary_rule.saved",
    details: { target },
  });

  revalidatePath(`/p/${projectId}/salaries`);
  return { error: null, saved: true };
}

/** Карточка договора. Файлы не храним — только реквизиты и сроки. */
export async function createContract(
  _prevState: HrFormState,
  formData: FormData,
): Promise<HrFormState> {
  const projectId = String(formData.get("project_id") ?? "");
  const { role, canManage, user } = await requireProjectContext(projectId);

  if (!mayManageMoney(role, canManage)) {
    return { error: "Договоры ведёт владелец или директор проекта.", saved: false };
  }

  const title = String(formData.get("title") ?? "").trim().slice(0, MAX_TEXT);
  if (title.length < 2) {
    return { error: "Укажите название договора.", saved: false };
  }

  const kind = String(formData.get("kind") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!isContractKind(kind) || !isContractStatus(status)) {
    return { error: "Выберите тип и статус договора.", saved: false };
  }

  const startsOn = String(formData.get("starts_on") ?? "");
  const endsOn = String(formData.get("ends_on") ?? "");
  if (startsOn && endsOn && isIsoDate(startsOn) && isIsoDate(endsOn) && endsOn < startsOn) {
    return { error: "Дата окончания раньше даты начала.", saved: false };
  }

  const userId = String(formData.get("user_id") ?? "");
  if (userId && !(await isMemberOfProject(projectId, userId))) {
    return { error: "Такого сотрудника нет в проекте.", saved: false };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("contracts").insert({
    project_id: projectId,
    title,
    kind,
    status,
    number: String(formData.get("number") ?? "").trim().slice(0, MAX_TEXT) || null,
    counterparty: String(formData.get("counterparty") ?? "").trim().slice(0, MAX_TEXT) || null,
    user_id: userId || null,
    amount: readMoney(formData, "amount"),
    starts_on: isIsoDate(startsOn) ? startsOn : null,
    ends_on: isIsoDate(endsOn) ? endsOn : null,
    note: String(formData.get("note") ?? "").trim().slice(0, MAX_TEXT) || null,
  });

  if (error) {
    return { error: "Не удалось сохранить договор. Попробуйте ещё раз.", saved: false };
  }

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "contract.created",
    details: { title, kind },
  });

  revalidatePath(`/p/${projectId}/contracts`);
  return { error: null, saved: true };
}

/** Смена статуса договора: расторгли, истёк, вернули в работу. */
export async function setContractStatus(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const contractId = String(formData.get("contract_id") ?? "");
  const status = String(formData.get("status") ?? "");

  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!mayManageMoney(role, canManage)) return;
  if (!isContractStatus(status)) return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("contracts")
    .update({ status })
    .eq("id", contractId)
    .eq("project_id", projectId);

  if (error) return;

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "contract.status_changed",
    details: { contract_id: contractId, status },
  });

  revalidatePath(`/p/${projectId}/contracts`);
}
