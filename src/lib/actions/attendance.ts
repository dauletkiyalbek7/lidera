"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isValidCoord } from "@/lib/geo";
import { hasServiceRoleKey } from "@/lib/queries/employees";

/** Геозона офиса для отметок посещения (ТЗ, Блок 5). Задаёт владелец или директор. */

export type OfficeState = { message: string | null; error: string | null };

export async function setOfficeLocation(
  _prev: OfficeState,
  formData: FormData,
): Promise<OfficeState> {
  const projectId = String(formData.get("project_id") ?? "");
  const lat = Number(String(formData.get("lat") ?? "").replace(",", "."));
  const lng = Number(String(formData.get("lng") ?? "").replace(",", "."));
  const radius = Math.round(Number(formData.get("radius") ?? ""));

  const { role, canManage } = await requireProjectContext(projectId);
  if (!(canManage || role === "director")) {
    return { message: null, error: "Геозону задаёт владелец или директор." };
  }
  if (!hasServiceRoleKey()) {
    return { message: null, error: "На сервере не задан ключ для сохранения." };
  }
  if (!isValidCoord(lat, lng)) {
    return { message: null, error: "Проверьте координаты офиса." };
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    return { message: null, error: "Радиус должен быть больше нуля." };
  }

  const { error } = await createSupabaseAdminClient()
    .from("projects")
    .update({ office_lat: lat, office_lng: lng, office_radius_m: radius })
    .eq("id", projectId);
  if (error) {
    return { message: null, error: "Не удалось сохранить геозону." };
  }

  revalidatePath(`/p/${projectId}/attendance`);
  return { message: `Офис сохранён. Радиус отметки — ${radius} м.`, error: null };
}
