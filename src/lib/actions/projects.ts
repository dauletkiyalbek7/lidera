"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireCurrentUser, requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isNiche, PLANS } from "@/lib/domain";

export type CreateProjectState = { error: string | null };

/** Создание проекта: название, ниша, директор (ТЗ, Этап 1). */
export async function createProject(
  _prevState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const user = await requireCurrentUser();

  const name = String(formData.get("name") ?? "").trim();
  const niche = String(formData.get("niche") ?? "");
  const directorName = String(formData.get("director_name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (name.length < 2) {
    return { error: "Название проекта — минимум 2 символа." };
  }
  if (!isNiche(niche)) {
    return { error: "Выберите нишу проекта." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      name,
      niche,
      director_name: directorName || null,
      description: description || null,
    })
    .select("id")
    .single();

  if (error || !project) {
    return { error: "Не удалось создать проект. Попробуйте ещё раз." };
  }

  await supabase.from("activity_log").insert({
    project_id: project.id,
    actor_id: user.id,
    action: "project.created",
    details: { name, niche },
  });

  revalidatePath("/projects");
  redirect(`/p/${project.id}`);
}

/**
 * Смена тарифа проекта (ТЗ, раздел 3, пункт 5).
 * Приём денег появится позже — пока тариф переключает владелец вручную.
 */
export async function setProjectPlan(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const plan = String(formData.get("plan") ?? "");

  const { canManage, user, project } = await requireProjectContext(projectId);
  if (!canManage) return;
  if (!(PLANS as readonly string[]).includes(plan) || plan === project.plan) return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("projects").update({ plan }).eq("id", projectId);
  if (error) return;

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "project.plan_changed",
    details: { from: project.plan, to: plan },
  });

  revalidatePath(`/p/${projectId}`, "layout");
  revalidatePath("/projects");
}
