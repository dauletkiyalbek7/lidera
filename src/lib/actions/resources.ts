"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isResourceType, normalizeResourceValue } from "@/lib/resources";

export type ResourceFormState = { error: string | null; saved: boolean };

const MAX_LABEL_LENGTH = 120;

/** Ресурсы ведёт владелец или директор проекта (ТЗ, Блок 3). */
function mayManageResources(role: string, canManage: boolean): boolean {
  return canManage || role === "director";
}

/** Добавление ресурса: WhatsApp-номер, сайт, лендинг или страница Tilda. */
export async function createResource(
  _prevState: ResourceFormState,
  formData: FormData,
): Promise<ResourceFormState> {
  const projectId = String(formData.get("project_id") ?? "");
  const { role, canManage, user } = await requireProjectContext(projectId);

  if (!mayManageResources(role, canManage)) {
    return { error: "Добавлять ресурсы может владелец или директор проекта.", saved: false };
  }

  const type = String(formData.get("type") ?? "");
  if (!isResourceType(type)) {
    return { error: "Выберите тип ресурса.", saved: false };
  }

  const normalized = normalizeResourceValue(type, String(formData.get("value") ?? ""));
  if (!normalized.ok) {
    return { error: normalized.error, saved: false };
  }

  const label = String(formData.get("label") ?? "")
    .trim()
    .slice(0, MAX_LABEL_LENGTH);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("resources").insert({
    project_id: projectId,
    type,
    label: label || null,
    value: normalized.value,
  });

  if (error) {
    return { error: "Не удалось сохранить ресурс. Попробуйте ещё раз.", saved: false };
  }

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "resource.created",
    details: { type, value: normalized.value },
  });

  revalidatePath(`/p/${projectId}/resources`);
  return { error: null, saved: true };
}

/** Удаление ресурса: номер сменился или лендинг закрыли — держать его в списке незачем. */
export async function deleteResource(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const resourceId = String(formData.get("resource_id") ?? "");

  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!mayManageResources(role, canManage)) return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("resources")
    .delete()
    .eq("id", resourceId)
    .eq("project_id", projectId);

  if (error) return;

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "resource.deleted",
    details: { resource_id: resourceId },
  });

  revalidatePath(`/p/${projectId}/resources`);
}
