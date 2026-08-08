import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createdAtBounds, type DateRange } from "@/lib/date-range";

/**
 * Данные раздела CAPI (ТЗ, Блок 3).
 * Событие покупки в Meta шлётся при подтверждении чека ботом; здесь показываем,
 * что уже ушло, что ждёт чека и что не удалось — чтобы статус был на виду.
 */

export type CapiEvent = {
  id: string;
  client: string;
  amount: number;
  receiptStatus: string;
  capiStatus: string;
  capiAt: string | null;
  createdAt: string;
};

type SaleRow = {
  id: string;
  amount: number;
  receipt_status: string;
  capi_status: string;
  capi_at: string | null;
  created_at: string;
  customers: { full_name: string } | null;
  leads: { full_name: string } | null;
};

export async function loadCapiEvents(
  projectId: string,
  range: DateRange,
): Promise<CapiEvent[]> {
  const supabase = await createSupabaseServerClient();
  const { since, until } = createdAtBounds(range);

  let query = supabase
    .from("sales")
    .select(
      "id, amount, receipt_status, capi_status, capi_at, created_at, customers(full_name), leads(full_name)",
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (since) query = query.gte("created_at", since);
  if (until) query = query.lt("created_at", until);

  const { data } = await query.overrideTypes<SaleRow[]>();
  return (data ?? []).map((row) => ({
    id: row.id,
    client: row.customers?.full_name ?? row.leads?.full_name ?? "—",
    amount: Number(row.amount),
    receiptStatus: row.receipt_status,
    capiStatus: row.capi_status,
    capiAt: row.capi_at,
    createdAt: row.created_at,
  }));
}

export type PixelStatus = { connected: boolean; pixelId: string | null };

/** Подключён ли пиксель Meta и его id — для шапки раздела CAPI. */
export async function loadPixelStatus(projectId: string): Promise<PixelStatus> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("integrations")
    .select("status, config")
    .eq("project_id", projectId)
    .eq("provider", "meta")
    .maybeSingle();

  const config = data?.config;
  const pixelId =
    config && typeof config === "object"
      ? ((config as Record<string, unknown>).pixel_id as string | undefined) ?? null
      : null;

  return { connected: data?.status === "connected" && Boolean(pixelId), pixelId };
}
