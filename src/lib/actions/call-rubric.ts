"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/queries/employees";
import { rubricFromForm, rubricIsEmpty } from "@/lib/call-rubric";
import type { Json } from "@/lib/database.types";

export type RubricState = { message: string | null; error: string | null };

/** Правила отдела продаж настраивает руководитель. */
function mayEditRubric(role: string, canManage: boolean): boolean {
  return canManage || role === "director" || role === "rop";
}

/**
 * Сохранение правил оценки звонков проекта. Пишем сервисным ключом: у директора/РОПа
 * нет своей RLS-политики на запись в projects, право проверяем в коде.
 */
export async function setCallRubric(
  _prev: RubricState,
  formData: FormData,
): Promise<RubricState> {
  const projectId = String(formData.get("project_id") ?? "");
  const { role, canManage } = await requireProjectContext(projectId);
  if (!mayEditRubric(role, canManage)) {
    return { message: null, error: "Менять правила может РОП или директор." };
  }
  if (!hasServiceRoleKey()) return { message: null, error: "На сервере нет ключа для записи." };

  const labels = formData.getAll("criteria_label").map((v) => String(v));
  const weights = formData.getAll("criteria_weight").map((v) => String(v));
  const script = String(formData.get("script") ?? "");
  const language = String(formData.get("language") ?? "kk");
  const rubric = rubricFromForm(labels, weights, script, language);

  if (rubricIsEmpty(rubric)) {
    return {
      message: null,
      error: "Задайте критерии с весами или опишите правила текстом.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("projects")
    .update({ call_rubric: rubric as unknown as Json })
    .eq("id", projectId);

  if (error) return { message: null, error: "Не удалось сохранить правила." };

  revalidatePath(`/p/${projectId}/call-analysis`);
  return { message: "Правила сохранены.", error: null };
}
