"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/queries/employees";
import { sendSaleCapi, skipSaleCapi } from "@/lib/queries/telegram-bot";

/** Кто решает отправку в рекламу: продажник своей продажи и руководители. */
function maySendCapi(role: string, canManage: boolean): boolean {
  return (
    canManage ||
    role === "director" ||
    role === "rop" ||
    role === "manager" ||
    role === "salesperson"
  );
}

/**
 * Отправить событие покупки в Meta по конкретной продаже — ручное решение из
 * кабинета (страница CAPI), когда клиент тёплый/горячий. То же действие, что и
 * кнопка в Telegram-боте, только с сайта.
 */
export async function sendSaleToMeta(
  projectId: string,
  saleId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!maySendCapi(role, canManage)) return { ok: false, error: "Нет прав на отправку." };
  if (!hasServiceRoleKey()) return { ok: false, error: "Нет ключа для отправки." };

  const admin = createSupabaseAdminClient();
  const result = await sendSaleCapi(admin, projectId, saleId, user.id);
  if (!result) return { ok: false, error: "Продажа не найдена." };

  revalidatePath(`/p/${projectId}/capi`);
  revalidatePath(`/p/${projectId}/sales`);
  return result.ok ? { ok: true } : { ok: false, error: "Meta не приняла событие. Попробуйте позже." };
}

/** Пометить продажу «не отправлять в рекламу» — холодный клиент. */
export async function skipSaleToMeta(
  projectId: string,
  saleId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!maySendCapi(role, canManage)) return { ok: false, error: "Нет прав." };
  if (!hasServiceRoleKey()) return { ok: false, error: "Нет ключа." };

  const admin = createSupabaseAdminClient();
  await skipSaleCapi(admin, projectId, saleId, user.id);

  revalidatePath(`/p/${projectId}/capi`);
  revalidatePath(`/p/${projectId}/sales`);
  return { ok: true };
}
