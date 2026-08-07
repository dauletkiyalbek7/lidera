"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isValidCoord } from "@/lib/geo";
import { isAttendanceStatus, OPTIONAL_ATTENDANCE_STATUSES } from "@/lib/hr";
import { ATTENDANCE_MODE_PREFIX } from "@/lib/queries/hr";
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

/**
 * Набор режимов табеля для проекта. Отмеченные галочками статусы сохраняем;
 * все выбраны — храним null (используются все). «На месте» включён всегда.
 */
export async function setAttendanceModes(
  _prev: OfficeState,
  formData: FormData,
): Promise<OfficeState> {
  const projectId = String(formData.get("project_id") ?? "");
  const { role, canManage } = await requireProjectContext(projectId);
  if (!(canManage || role === "director")) {
    return { message: null, error: "Режимы табеля настраивает владелец или директор." };
  }
  if (!hasServiceRoleKey()) {
    return { message: null, error: "На сервере не задан ключ для сохранения." };
  }

  const chosen = new Set(formData.getAll("status").map(String).filter(isAttendanceStatus));

  // По строке на каждый необязательный статус: включён он или нет. «present» не
  // храним — он всегда доступен. Пишем рядом с тумблерами разделов (ключи attn.*).
  const rows = OPTIONAL_ATTENDANCE_STATUSES.map((status) => ({
    project_id: projectId,
    section_key: `${ATTENDANCE_MODE_PREFIX}${status}`,
    enabled: chosen.has(status),
  }));

  const { error } = await createSupabaseAdminClient()
    .from("project_sections")
    .upsert(rows, { onConflict: "project_id,section_key" });
  if (error) {
    return { message: null, error: "Не удалось сохранить режимы." };
  }

  revalidatePath(`/p/${projectId}/attendance`);
  const count = 1 + rows.filter((row) => row.enabled).length;
  return { message: `Режимы табеля сохранены (${count}).`, error: null };
}
