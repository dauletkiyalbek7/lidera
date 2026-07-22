import "server-only";

import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createdAtBounds, type DateRange } from "@/lib/date-range";
import { asGlobalRole, type GlobalRole } from "@/lib/domain";
import type { Tables } from "@/lib/database.types";

/** Общие запросы разделов «Продажи и CRM». Все они ограничены RLS проекта. */

export type Member = {
  /** id строки project_members — по нему увольняем и возвращаем. */
  id: string;
  userId: string;
  fullName: string;
  role: GlobalRole;
  status: string;
  hiredAt: string;
  firedAt: string | null;
};

/** Строка состава вместе с именем из profiles — одним запросом через связь по внешнему ключу. */
type MemberWithProfile = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  hired_at: string;
  fired_at: string | null;
  profiles: { full_name: string } | null;
};

/**
 * Состав проекта с именами.
 * cache() — чтобы разные блоки страницы не спрашивали одно и то же дважды за рендер.
 */
export const loadMembers = cache(async (projectId: string): Promise<Member[]> => {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("project_members")
    .select("id, user_id, role, status, hired_at, fired_at, profiles(full_name)")
    .eq("project_id", projectId)
    .order("hired_at", { ascending: true })
    .overrideTypes<MemberWithProfile[]>();

  return (data ?? []).map((member) => ({
    id: member.id,
    userId: member.user_id,
    fullName: member.profiles?.full_name ?? "Сотрудник",
    role: asGlobalRole(member.role),
    status: member.status,
    hiredAt: member.hired_at,
    firedAt: member.fired_at,
  }));
});

export async function loadLeads(
  projectId: string,
  range: DateRange,
  options: { statuses?: readonly string[]; assignedTo?: string } = {},
): Promise<Tables<"leads">[]> {
  const supabase = await createSupabaseServerClient();
  const { since, until } = createdAtBounds(range);

  let query = supabase
    .from("leads")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (since) query = query.gte("created_at", since);
  if (until) query = query.lt("created_at", until);
  if (options.statuses) query = query.in("status", [...options.statuses]);
  if (options.assignedTo) query = query.eq("assigned_to", options.assignedTo);

  const { data } = await query;
  return data ?? [];
}

export async function loadSales(
  projectId: string,
  range: DateRange,
  options: { sellerId?: string } = {},
): Promise<Tables<"sales">[]> {
  const supabase = await createSupabaseServerClient();
  const { since, until } = createdAtBounds(range);

  let query = supabase
    .from("sales")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (since) query = query.gte("created_at", since);
  if (until) query = query.lt("created_at", until);
  if (options.sellerId) query = query.eq("seller_id", options.sellerId);

  const { data } = await query;
  return data ?? [];
}

export async function loadCustomers(projectId: string): Promise<Tables<"customers">[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("project_id", projectId)
    .order("total_spent", { ascending: false });
  return data ?? [];
}

/** Каталог склада. Состояние на сейчас, поэтому диапазон дат его не фильтрует. */
export const loadProducts = cache(async (projectId: string): Promise<Tables<"products">[]> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("project_id", projectId)
    .order("stock_quantity", { ascending: true });
  return data ?? [];
});

/** Метрики периода из metrics_daily — для карточек над списками. */
export async function loadRangeMetrics(projectId: string, range: DateRange) {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("metrics_daily")
    .select("date, leads, qualified, trial_lessons, sales, revenue, ad_spend")
    .eq("project_id", projectId);

  if (range.from) query = query.gte("date", range.from);
  if (range.to) query = query.lte("date", range.to);

  const { data } = await query;
  return data ?? [];
}
