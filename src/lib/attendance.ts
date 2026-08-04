import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { today } from "@/lib/date-range";
import { haversineMeters } from "@/lib/geo";

/**
 * Посещения и смена (ТЗ, Блок 5 + процесс продаж).
 *
 * Приход отмечает день в табеле как «на месте» и ставит участнику `on_shift`,
 * от которого зависит раздача лидов и пробных. Если у проекта задана геозона —
 * приход засчитываем только внутри радиуса; нет геозоны — отмечаемся без проверки
 * (запасной ручной вариант). Пишем сервисным ключом: у сотрудника нет своей
 * RLS-политики на запись, право уже проверено привязкой/сессией.
 */

type Admin = SupabaseClient<Database>;

export type Office = { lat: number; lng: number; radius: number };

/** Геозона офиса проекта; null — координаты не заданы. */
export async function loadOffice(admin: Admin, projectId: string): Promise<Office | null> {
  const { data } = await admin
    .from("projects")
    .select("office_lat, office_lng, office_radius_m")
    .eq("id", projectId)
    .maybeSingle();

  if (!data || data.office_lat == null || data.office_lng == null) return null;
  return {
    lat: Number(data.office_lat),
    lng: Number(data.office_lng),
    radius: data.office_radius_m ?? 150,
  };
}

export type CheckInResult = {
  ok: boolean;
  /** Была ли включена проверка радиуса. */
  geofenced: boolean;
  /** Метры до офиса, если геозона задана. */
  distance: number | null;
  /** Радиус геозоны, если задана. */
  radius: number | null;
};

/** Ставит участнику «на смене» и отмечает день в табеле. Общий хвост прихода. */
async function openShift(
  admin: Admin,
  projectId: string,
  userId: string,
  coords: { lat: number; lng: number } | null,
): Promise<void> {
  const now = new Date().toISOString();
  await admin.from("attendance").upsert(
    {
      project_id: projectId,
      user_id: userId,
      date: today(),
      status: "present",
      check_in_at: now,
      check_in_lat: coords?.lat ?? null,
      check_in_lng: coords?.lng ?? null,
      marked_by: userId,
    },
    { onConflict: "project_id,user_id,date" },
  );
  await admin
    .from("project_members")
    .update({ on_shift: true })
    .eq("project_id", projectId)
    .eq("user_id", userId);
}

/**
 * Приход по геолокации: внутри радиуса — на смену и отметка «на месте»; вне —
 * отказ с расстоянием. Нет геозоны — засчитываем без проверки координат.
 */
export async function recordCheckIn(
  admin: Admin,
  projectId: string,
  userId: string,
  lat: number,
  lng: number,
): Promise<CheckInResult> {
  const office = await loadOffice(admin, projectId);
  if (office) {
    const distance = haversineMeters(lat, lng, office.lat, office.lng);
    if (distance > office.radius) {
      return { ok: false, geofenced: true, distance, radius: office.radius };
    }
    await openShift(admin, projectId, userId, { lat, lng });
    return { ok: true, geofenced: true, distance, radius: office.radius };
  }

  await openShift(admin, projectId, userId, { lat, lng });
  return { ok: true, geofenced: false, distance: null, radius: null };
}

/** Ручная отметка «на смене» без геолокации (запасной вариант, десктоп/тумблер). */
export async function recordManualShift(
  admin: Admin,
  projectId: string,
  userId: string,
): Promise<void> {
  await openShift(admin, projectId, userId, null);
}

/** Уход со смены: закрываем день в табеле и снимаем «на смене». */
export async function recordCheckOut(
  admin: Admin,
  projectId: string,
  userId: string,
): Promise<void> {
  await admin
    .from("attendance")
    .update({ check_out_at: new Date().toISOString() })
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("date", today());
  await admin
    .from("project_members")
    .update({ on_shift: false })
    .eq("project_id", projectId)
    .eq("user_id", userId);
}
