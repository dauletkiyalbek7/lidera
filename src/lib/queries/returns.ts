import "server-only";

import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createdAtBounds, type DateRange } from "@/lib/date-range";
import type { ReturnsTotals } from "@/lib/metrics";

/** Возвраты (ТЗ, Блок 2). Оформляет РОП или директор, история сохраняется навсегда. */

export type ReturnRecord = {
  id: string;
  amount: number;
  reason: string | null;
  createdAt: string;
  processedBy: string | null;
  saleId: string | null;
  /** Данные исходной продажи — подтягиваем связью, отдельным запросом ходить незачем. */
  product: string | null;
  saleAmount: number | null;
  saleDate: string | null;
};

type ReturnWithSale = {
  id: string;
  amount: number | string;
  reason: string | null;
  created_at: string;
  processed_by: string | null;
  sale_id: string | null;
  sales: { product: string | null; amount: number | string; created_at: string } | null;
};

function toRecord(row: ReturnWithSale): ReturnRecord {
  return {
    id: row.id,
    amount: Number(row.amount),
    reason: row.reason,
    createdAt: row.created_at,
    processedBy: row.processed_by,
    saleId: row.sale_id,
    product: row.sales?.product ?? null,
    saleAmount: row.sales ? Number(row.sales.amount) : null,
    saleDate: row.sales?.created_at ?? null,
  };
}

export const loadReturns = cache(
  async (projectId: string, range: DateRange): Promise<ReturnRecord[]> => {
    const supabase = await createSupabaseServerClient();
    const { since, until } = createdAtBounds(range);

    let query = supabase
      .from("returns")
      .select("id, amount, reason, created_at, processed_by, sale_id, sales(product, amount, created_at)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (since) query = query.gte("created_at", since);
    if (until) query = query.lt("created_at", until);

    const { data } = await query.overrideTypes<ReturnWithSale[]>();
    return (data ?? []).map(toRecord);
  },
);

/**
 * Сумма и количество возвратов за период — для карточек и пересчёта прибыли.
 * Границы принимаем сырыми, потому что Главная сравнивает ещё и прошлый период.
 */
export async function loadReturnsTotals(
  projectId: string,
  bounds: { from: string | null; to: string | null },
): Promise<ReturnsTotals> {
  const supabase = await createSupabaseServerClient();
  const { since, until } = createdAtBounds(bounds);

  let query = supabase.from("returns").select("amount").eq("project_id", projectId);
  if (since) query = query.gte("created_at", since);
  if (until) query = query.lt("created_at", until);

  const { data } = await query;
  return (data ?? []).reduce<ReturnsTotals>(
    (totals, row) => ({ count: totals.count + 1, amount: totals.amount + Number(row.amount) }),
    { count: 0, amount: 0 },
  );
}

export type ReturnableSale = {
  id: string;
  product: string | null;
  amount: number;
  createdAt: string;
  /** Сколько по этой продаже ещё можно вернуть. */
  remaining: number;
};

const RETURNABLE_SALES_LIMIT = 200;

/**
 * Продажи, по которым ещё есть что возвращать.
 * Диапазон дат здесь не применяем: возврат обычно оформляют по сделке прошлых недель.
 */
export async function loadReturnableSales(projectId: string): Promise<ReturnableSale[]> {
  const supabase = await createSupabaseServerClient();

  const [salesResult, returnsResult] = await Promise.all([
    supabase
      .from("sales")
      .select("id, product, amount, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(RETURNABLE_SALES_LIMIT),
    supabase.from("returns").select("sale_id, amount").eq("project_id", projectId),
  ]);

  const returnedBySale = new Map<string, number>();
  for (const row of returnsResult.data ?? []) {
    if (!row.sale_id) continue;
    returnedBySale.set(row.sale_id, (returnedBySale.get(row.sale_id) ?? 0) + Number(row.amount));
  }

  return (salesResult.data ?? [])
    .map((sale) => {
      const amount = Number(sale.amount);
      return {
        id: sale.id,
        product: sale.product,
        amount,
        createdAt: sale.created_at,
        remaining: amount - (returnedBySale.get(sale.id) ?? 0),
      };
    })
    .filter((sale) => sale.remaining > 0);
}
