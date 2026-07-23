"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { distributeUnassigned } from "@/lib/leads/assign";
import { hasServiceRoleKey } from "@/lib/queries/employees";

/** Раздача лидов и смена (ТЗ, Блок 2). */

function mayDistribute(role: string, canManage: boolean): boolean {
  return canManage || role === "director" || role === "rop";
}

export type DistributeState = { message: string | null; error: string | null };

/** Кнопка РОПа «Авто-раздача»: накопленные «новые» лиды уходят по кругу. */
export async function autoDistribute(
  _prev: DistributeState,
  formData: FormData,
): Promise<DistributeState> {
  const projectId = String(formData.get("project_id") ?? "");
  const { role, canManage } = await requireProjectContext(projectId);
  if (!mayDistribute(role, canManage)) {
    return { message: null, error: "Раздачу запускает РОП, директор или владелец." };
  }
  if (!hasServiceRoleKey()) {
    return { message: null, error: "На сервере не задан ключ для раздачи." };
  }

  const result = await distributeUnassigned(createSupabaseAdminClient(), projectId);
  revalidatePath(`/p/${projectId}/leads`);

  if (result.noManagers) {
    return { message: null, error: "На смене нет ни одного менеджера — некому раздавать." };
  }
  if (result.assigned === 0) {
    return { message: "Нераспределённых лидов нет — всё уже роздано.", error: null };
  }
  return {
    message: `Роздано лидов: ${result.assigned} между ${result.managers} менеджерами на смене.`,
    error: null,
  };
}

/** Сотрудник встаёт на смену или уходит с неё. Меняет только свою строку. */
export async function toggleShift(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const next = String(formData.get("on_shift") ?? "") === "1";

  const { user } = await requireProjectContext(projectId);
  if (!hasServiceRoleKey()) return;

  await createSupabaseAdminClient()
    .from("project_members")
    .update({ on_shift: next })
    .eq("project_id", projectId)
    .eq("user_id", user.id);

  revalidatePath(`/p/${projectId}/manager-office`);
  revalidatePath(`/p/${projectId}/salesperson-office`);
  revalidatePath(`/p/${projectId}/leads`);
}
