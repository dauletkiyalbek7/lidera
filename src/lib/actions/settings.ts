"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSectionByKey, LOCKED_SECTION_KEYS } from "@/lib/navigation";
import { isProjectRole } from "@/lib/domain";

/** Тумблер «раздел включён на проекте» (ТЗ, Блок 6). */
export async function toggleProjectSection(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const sectionKey = String(formData.get("section_key") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";

  const { canManage, user } = await requireProjectContext(projectId);
  if (!canManage) return;
  if (!getSectionByKey(sectionKey)) return;
  if ((LOCKED_SECTION_KEYS as readonly string[]).includes(sectionKey)) return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("project_sections")
    .upsert(
      { project_id: projectId, section_key: sectionKey, enabled },
      { onConflict: "project_id,section_key" },
    );

  if (error) return;

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: enabled ? "section.enabled" : "section.disabled",
    details: { section_key: sectionKey },
  });

  revalidatePath(`/p/${projectId}`, "layout");
}

/**
 * Права роли на раздел (ТЗ, Блок 6).
 * Отсутствие строки означает «как задано ролью по умолчанию»,
 * поэтому пишем строку только когда владелец что-то поменял.
 */
export async function setAccessRight(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const sectionKey = String(formData.get("section_key") ?? "");
  const role = String(formData.get("role") ?? "");
  const canView = String(formData.get("can_view") ?? "") === "true";
  const canEdit = String(formData.get("can_edit") ?? "") === "true";

  const { canManage, user } = await requireProjectContext(projectId);
  if (!canManage) return;
  if (!getSectionByKey(sectionKey) || !isProjectRole(role)) return;

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("access_rights")
    .select("id")
    .eq("project_id", projectId)
    .eq("section_key", sectionKey)
    .eq("role", role)
    .is("user_id", null)
    .maybeSingle();

  const { error } = existing
    ? await supabase
        .from("access_rights")
        .update({ can_view: canView, can_edit: canEdit && canView })
        .eq("id", existing.id)
    : await supabase.from("access_rights").insert({
        project_id: projectId,
        section_key: sectionKey,
        role,
        can_view: canView,
        can_edit: canEdit && canView,
      });

  if (error) return;

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "access.changed",
    details: { section_key: sectionKey, role, can_view: canView, can_edit: canEdit },
  });

  revalidatePath(`/p/${projectId}`, "layout");
}
