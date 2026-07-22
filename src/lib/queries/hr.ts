import "server-only";

import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createdAtBounds, type DateRange } from "@/lib/date-range";
import { EMPTY_SALARY_RULE, isPaidStatus, type SalaryInputs, type SalaryRule } from "@/lib/hr";
import type { Tables } from "@/lib/database.types";

/** Запросы блока «Финансы и HR» (ТЗ, Блок 5). Всё ограничено RLS проекта. */

export const loadAttendance = cache(
  async (projectId: string, range: DateRange): Promise<Tables<"attendance">[]> => {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("attendance")
      .select("*")
      .eq("project_id", projectId)
      .order("date", { ascending: true });

    if (range.from) query = query.gte("date", range.from);
    if (range.to) query = query.lte("date", range.to);

    const { data } = await query;
    return data ?? [];
  },
);

export const loadWorkShifts = cache(
  async (projectId: string): Promise<Tables<"work_shifts">[]> => {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase
      .from("work_shifts")
      .select("*")
      .eq("project_id", projectId)
      .order("weekday", { ascending: true });
    return data ?? [];
  },
);

export const loadContracts = cache(async (projectId: string): Promise<Tables<"contracts">[]> => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("contracts")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return data ?? [];
});

export const loadSalaryRules = cache(
  async (projectId: string): Promise<Tables<"salary_rules">[]> => {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("salary_rules").select("*").eq("project_id", projectId);
    return data ?? [];
  },
);

/**
 * Правило для конкретного сотрудника: точечное перебивает правило роли.
 * Нет ни того ни другого — начислять нечего.
 */
export function resolveSalaryRule(
  rules: readonly Tables<"salary_rules">[],
  userId: string,
  role: string,
): { rule: SalaryRule; source: "user" | "role" | "none" } {
  const personal = rules.find((row) => row.user_id === userId);
  const byRole = rules.find((row) => row.user_id === null && row.role === role);
  const row = personal ?? byRole;

  if (!row) return { rule: EMPTY_SALARY_RULE, source: "none" };

  return {
    rule: {
      baseSalary: Number(row.base_salary),
      percentOfSales: Number(row.percent_of_sales),
      perTrial: Number(row.per_trial),
      perQualifiedLead: Number(row.per_qualified_lead),
    },
    source: personal ? "user" : "role",
  };
}

/** Лид считается доведённым до пробного, начиная с этих статусов. */
const TRIAL_STATUSES = ["trial_booked", "trial_done", "sale"];

export type SalaryInputsByUser = Map<string, SalaryInputs>;

/**
 * Показатели всех сотрудников за период одним заходом.
 * Считаем на сервере из тех же таблиц, что и остальные разделы: продажи за вычетом
 * возвратов по ним, лиды по ответственному, дни из табеля посещаемости.
 */
export async function loadSalaryInputs(
  projectId: string,
  range: DateRange,
): Promise<SalaryInputsByUser> {
  const supabase = await createSupabaseServerClient();
  const { since, until } = createdAtBounds(range);

  let salesQuery = supabase
    .from("sales")
    .select("id, seller_id, amount")
    .eq("project_id", projectId)
    .not("seller_id", "is", null);
  if (since) salesQuery = salesQuery.gte("created_at", since);
  if (until) salesQuery = salesQuery.lt("created_at", until);

  let leadsQuery = supabase
    .from("leads")
    .select("assigned_to, status")
    .eq("project_id", projectId)
    .not("assigned_to", "is", null);
  if (since) leadsQuery = leadsQuery.gte("created_at", since);
  if (until) leadsQuery = leadsQuery.lt("created_at", until);

  const [salesResult, leadsResult, returnsResult, attendance] = await Promise.all([
    salesQuery,
    leadsQuery,
    // Возвраты берём все: деньги могли вернуть позже, но снимать их надо с той же продажи.
    supabase.from("returns").select("sale_id, amount").eq("project_id", projectId),
    loadAttendance(projectId, range),
  ]);

  const returnedBySale = new Map<string, number>();
  for (const row of returnsResult.data ?? []) {
    if (!row.sale_id) continue;
    returnedBySale.set(row.sale_id, (returnedBySale.get(row.sale_id) ?? 0) + Number(row.amount));
  }

  const inputs: SalaryInputsByUser = new Map();
  const ensure = (userId: string): SalaryInputs => {
    const existing = inputs.get(userId);
    if (existing) return existing;
    const created: SalaryInputs = {
      netSales: 0,
      trials: 0,
      qualifiedLeads: 0,
      paidDays: 0,
      absentDays: 0,
      markedDays: 0,
    };
    inputs.set(userId, created);
    return created;
  };

  for (const sale of salesResult.data ?? []) {
    if (!sale.seller_id) continue;
    const net = Number(sale.amount) - (returnedBySale.get(sale.id) ?? 0);
    ensure(sale.seller_id).netSales += Math.max(0, net);
  }

  for (const lead of leadsResult.data ?? []) {
    if (!lead.assigned_to) continue;
    const row = ensure(lead.assigned_to);
    if (lead.status !== "new") row.qualifiedLeads += 1;
    if (TRIAL_STATUSES.includes(lead.status)) row.trials += 1;
  }

  for (const day of attendance) {
    const row = ensure(day.user_id);
    row.markedDays += 1;
    if (isPaidStatus(day.status)) row.paidDays += 1;
    if (day.status === "absent") row.absentDays += 1;
  }

  return inputs;
}
