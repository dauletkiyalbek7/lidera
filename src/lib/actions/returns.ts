"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ReturnFormState = { error: string | null; saved: boolean };

const MAX_REASON_LENGTH = 500;

/** Кто оформляет возвраты (ТЗ, раздел 4): РОП и директор. Владелец — как везде. */
function mayProcessReturns(role: string, canManage: boolean): boolean {
  return canManage || role === "director" || role === "rop";
}

/**
 * Оформление возврата по продаже (ТЗ, Блок 2).
 * Саму продажу не трогаем и не удаляем: возврат — отдельная запись, история сохраняется.
 */
export async function createReturn(
  _prevState: ReturnFormState,
  formData: FormData,
): Promise<ReturnFormState> {
  const projectId = String(formData.get("project_id") ?? "");
  const { role, canManage, user } = await requireProjectContext(projectId);

  if (!mayProcessReturns(role, canManage)) {
    return { error: "Возврат оформляет РОП или директор проекта.", saved: false };
  }

  const saleId = String(formData.get("sale_id") ?? "");
  if (!saleId) {
    return { error: "Выберите продажу, по которой оформляется возврат.", saved: false };
  }

  const supabase = await createSupabaseServerClient();

  // Продажу и уже оформленные по ней возвраты перечитываем на сервере:
  // форма могла быть открыта давно, а деньги за это время уже вернули.
  const [saleResult, returnsResult] = await Promise.all([
    supabase
      .from("sales")
      .select("id, amount, product")
      .eq("id", saleId)
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase.from("returns").select("amount").eq("sale_id", saleId).eq("project_id", projectId),
  ]);

  const sale = saleResult.data;
  if (!sale) {
    return { error: "Продажа не найдена в этом проекте.", saved: false };
  }

  const alreadyReturned = (returnsResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.amount),
    0,
  );
  const remaining = Number(sale.amount) - alreadyReturned;

  const amount = Number(String(formData.get("amount") ?? "").replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Укажите сумму возврата больше нуля.", saved: false };
  }
  if (amount > remaining) {
    return {
      error:
        remaining > 0
          ? `По этой продаже можно вернуть не больше ${Math.round(remaining)}.`
          : "По этой продаже деньги уже возвращены полностью.",
      saved: false,
    };
  }

  const reason = String(formData.get("reason") ?? "").trim().slice(0, MAX_REASON_LENGTH);

  const { error } = await supabase.from("returns").insert({
    project_id: projectId,
    sale_id: saleId,
    amount,
    reason: reason || null,
    processed_by: user.id,
  });

  if (error) {
    return { error: "Не удалось оформить возврат. Попробуйте ещё раз.", saved: false };
  }

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "return.created",
    details: { sale_id: saleId, amount, product: sale.product },
  });

  revalidatePath(`/p/${projectId}/returns`);
  revalidatePath(`/p/${projectId}/sales`);
  revalidatePath(`/p/${projectId}`);
  return { error: null, saved: true };
}
