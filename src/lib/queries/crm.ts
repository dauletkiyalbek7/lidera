import "server-only";

import { cache } from "react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/paginate";
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
  /** На смене ли сейчас — по этому признаку идёт раздача лидов. */
  onShift: boolean;
};

/** Строка состава вместе с именем из profiles — одним запросом через связь по внешнему ключу. */
type MemberWithProfile = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  hired_at: string;
  fired_at: string | null;
  on_shift: boolean;
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
    .select("id, user_id, role, status, hired_at, fired_at, on_shift, profiles(full_name)")
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
    onShift: member.on_shift ?? false,
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

/** Активные пробные продажника: записанные к проведению и проведённые, ждущие продажи. */
const ACTIVE_TRIAL_STATUSES = ["trial_booked", "trial_done"] as const;

/**
 * Очередь пробных уроков продажника: записанные (провести) и проведённые (закрыть
 * продажу). Фильтруем по назначенному продажнику или берём все по проекту (для
 * руководителя). Дату записи (created_at) не учитываем — важна дата урока.
 */
export async function loadTrialQueue(
  projectId: string,
  options: { salespersonId?: string } = {},
): Promise<Tables<"leads">[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("leads")
    .select("*")
    .eq("project_id", projectId)
    .in("status", [...ACTIVE_TRIAL_STATUSES])
    .order("trial_at", { ascending: true, nullsFirst: false });

  if (options.salespersonId) query = query.eq("salesperson_id", options.salespersonId);

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

/** Название и метка креатива по id — чтобы в списке лидов показать, откуда пришёл лид. */
export async function loadCreativeLabels(
  projectId: string,
  ids: string[],
): Promise<Map<string, { name: string; label: string | null }>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("creatives")
    .select("id, name, utm_label")
    .eq("project_id", projectId)
    .in("id", unique);

  return new Map((data ?? []).map((row) => [row.id, { name: row.name, label: row.utm_label }]));
}

export type CreativeOption = { id: string; label: string; name: string };

/**
 * Креативы с UTM-меткой — для выбора при ручном заведении лида (WhatsApp).
 * Берём только помеченные: это и есть креативы, которые владелец включил в
 * привязку. По метке менеджер узнаёт, с какого объявления пришёл человек.
 */
export async function loadCreativeOptions(projectId: string): Promise<CreativeOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("creatives")
    .select("id, name, utm_label")
    .eq("project_id", projectId)
    .not("utm_label", "is", null)
    .order("utm_label", { ascending: true });

  return (data ?? [])
    .filter((row) => row.utm_label && row.utm_label.trim())
    .map((row) => ({ id: row.id, label: row.utm_label as string, name: row.name }));
}

export type CreativePickOption = {
  id: string;
  /** Что показываем в списке: метка, иначе имя объявления. */
  title: string;
  /** Подсказка справа — расход, чтобы отличать одинаково названные объявления. */
  spend: number;
};

/**
 * Все значимые креативы для ручного выбора на лиде (без привязки к UTM).
 * «Значимые» — те, что реально работали (был расход) или помечены/активны:
 * объявлений в кабинете тысячи, и показывать нулевой мусор в списке незачем.
 * Сортируем по расходу — сверху те, на что реально тратили деньги.
 */
export async function loadCreativePickerOptions(
  projectId: string,
): Promise<CreativePickOption[]> {
  const supabase = await createSupabaseServerClient();

  const [creatives, insights] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("creatives")
        .select("id, name, utm_label, status")
        .eq("project_id", projectId)
        .order("id")
        .range(from, to),
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("ad_creative_insights_daily")
        .select("creative_id, spend")
        .eq("project_id", projectId)
        .order("id")
        .range(from, to),
    ),
  ]);

  const spendByCreative = new Map<string, number>();
  for (const row of insights) {
    const id = row.creative_id as string;
    spendByCreative.set(id, (spendByCreative.get(id) ?? 0) + Number(row.spend));
  }

  return creatives
    .map((row) => ({
      id: row.id,
      title: (row.utm_label && row.utm_label.trim()) || row.name,
      spend: spendByCreative.get(row.id) ?? 0,
      status: row.status,
      labeled: Boolean(row.utm_label && row.utm_label.trim()),
    }))
    // Оставляем то, что стоит выбирать: с расходом, с меткой или активное.
    .filter((row) => row.spend > 0 || row.labeled || row.status === "ACTIVE")
    .sort((a, b) => b.spend - a.spend || a.title.localeCompare(b.title))
    .map(({ id, title, spend }) => ({ id, title, spend }));
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
