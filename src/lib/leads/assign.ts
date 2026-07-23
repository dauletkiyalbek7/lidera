import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { notifyLeadsAssigned } from "@/lib/notify";

/**
 * Раздача лидов по кругу (ТЗ, Блок 2).
 *
 * «По кругу» реализуем как «самому свободному»: входящий лид идёт менеджеру на
 * смене с наименьшей текущей нагрузкой. При равном старте это и есть очередь по
 * кругу, но вариант устойчивее — новый менеджер или ушедший со смены не ломают
 * порядок, и распределение всегда выравнивается.
 */

type Admin = SupabaseClient<Database>;

/** Лид считаем закрытым, когда он купил курс: такие в нагрузку не идут. */
const CLOSED_STATUS = "sale";

/** Пробный ещё в работе у продажника, пока не проведён. */
const OPEN_TRIAL_STATUSES = ["trial_booked"] as const;

type Workload = { userId: string; open: number };

/**
 * Сотрудники роли на смене вместе с их текущей нагрузкой, от свободного к занятому.
 * Раздача общая для менеджеров и продажников, различаются лишь колонка назначения
 * и что считать «в работе»: у менеджера — все незакрытые лиды, у продажника —
 * только непроведённые пробные.
 */
async function onShiftWorkers(
  admin: Admin,
  projectId: string,
  role: "manager" | "salesperson",
  assignColumn: "assigned_to" | "salesperson_id",
  openStatuses: readonly string[] | null,
): Promise<Workload[]> {
  const { data: members } = await admin
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId)
    .eq("role", role)
    .eq("status", "active")
    .eq("on_shift", true);

  const ids = (members ?? []).map((row) => row.user_id);
  if (ids.length === 0) return [];

  let query = admin
    .from("leads")
    .select(assignColumn)
    .eq("project_id", projectId)
    .in(assignColumn, ids);
  query = openStatuses
    ? query.in("status", [...openStatuses])
    : query.neq("status", CLOSED_STATUS);

  const { data: openLeads } = await query;

  const open = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const lead of (openLeads ?? []) as Record<string, string | null>[]) {
    const owner = lead[assignColumn];
    if (owner) open.set(owner, (open.get(owner) ?? 0) + 1);
  }

  // Свободные первыми; при равенстве — по id, чтобы порядок был предсказуем.
  return ids
    .map((userId) => ({ userId, open: open.get(userId) ?? 0 }))
    .sort((a, b) => a.open - b.open || a.userId.localeCompare(b.userId));
}

/** Менеджеры на смене — по числу незакрытых лидов. */
function onShiftManagers(admin: Admin, projectId: string): Promise<Workload[]> {
  return onShiftWorkers(admin, projectId, "manager", "assigned_to", null);
}

/** Продажники на смене — по числу непроведённых пробных. */
function onShiftSalespeople(admin: Admin, projectId: string): Promise<Workload[]> {
  return onShiftWorkers(admin, projectId, "salesperson", "salesperson_id", OPEN_TRIAL_STATUSES);
}

/**
 * Назначает один входящий лид. Возвращает id менеджера или null, если на смене
 * никого нет — тогда лид остаётся «новым» до утренней раздачи.
 */
export async function assignIncomingLead(
  admin: Admin,
  projectId: string,
  leadId: string,
): Promise<string | null> {
  const managers = await onShiftManagers(admin, projectId);
  if (managers.length === 0) return null;

  const managerId = managers[0].userId;
  const { error } = await admin
    .from("leads")
    .update({ assigned_to: managerId })
    .eq("id", leadId)
    .eq("project_id", projectId)
    .is("assigned_to", null);

  return error ? null : managerId;
}

export type DistributeResult = {
  assigned: number;
  managers: number;
  /** Никого на смене — раздавать некому. */
  noManagers: boolean;
};

/**
 * Раздаёт все нераспределённые «новые» лиды между менеджерами на смене.
 * Это кнопка РОПа «Авто-раздача»: накопленное за ночь уходит по кругу.
 */
export async function distributeUnassigned(
  admin: Admin,
  projectId: string,
): Promise<DistributeResult> {
  const managers = await onShiftManagers(admin, projectId);
  if (managers.length === 0) {
    return { assigned: 0, managers: 0, noManagers: true };
  }

  const { data: leads } = await admin
    .from("leads")
    .select("id, full_name, phone, source")
    .eq("project_id", projectId)
    .is("assigned_to", null)
    .eq("status", "new")
    .order("created_at", { ascending: true });

  const queue = leads ?? [];
  if (queue.length === 0) {
    return { assigned: 0, managers: managers.length, noManagers: false };
  }

  // Продолжаем от текущей нагрузки: раздаём каждый лид самому свободному.
  const load = new Map(managers.map((m) => [m.userId, m.open]));
  const order = managers.map((m) => m.userId);
  const perManager = new Map<string, number>();

  let assigned = 0;
  for (const lead of queue) {
    const managerId = order.reduce((best, id) =>
      (load.get(id) ?? 0) < (load.get(best) ?? 0) ? id : best,
    );
    const { error } = await admin
      .from("leads")
      .update({ assigned_to: managerId })
      .eq("id", lead.id)
      .eq("project_id", projectId)
      .is("assigned_to", null);
    if (error) continue;

    load.set(managerId, (load.get(managerId) ?? 0) + 1);
    perManager.set(managerId, (perManager.get(managerId) ?? 0) + 1);
    assigned += 1;
  }

  // Одно сводное сообщение каждому — не заваливаем чат отдельными.
  await notifyLeadsAssigned(admin, projectId, perManager);

  return { assigned, managers: managers.length, noManagers: false };
}

/**
 * Назначает пробный продажнику на смене с наименьшей очередью — та же раздача по
 * кругу. Возвращает id продажника или null, если никого нет на смене: тогда
 * пробный ждёт свободного продажника (его подхватит РОП или сам продажник).
 * Ставим только если продажник ещё не назначен — чтобы не переписать вручную выбранного.
 */
export async function assignTrial(
  admin: Admin,
  projectId: string,
  leadId: string,
): Promise<string | null> {
  const salespeople = await onShiftSalespeople(admin, projectId);
  if (salespeople.length === 0) return null;

  const salespersonId = salespeople[0].userId;
  const { error } = await admin
    .from("leads")
    .update({ salesperson_id: salespersonId })
    .eq("id", leadId)
    .eq("project_id", projectId)
    .is("salesperson_id", null);

  return error ? null : salespersonId;
}
