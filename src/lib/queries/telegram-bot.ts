import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { createdAtBounds, startOfMonth, today } from "@/lib/date-range";
import type { ProjectRole } from "@/lib/domain";

/**
 * Персональные показатели для Telegram-бота (ТЗ, раздел 7).
 *
 * Сотрудник спрашивает у бота «мои показатели» — отвечаем его же цифрами за
 * сегодня и за месяц, в тех же терминах, что и на сайте. Считаем сервисным
 * ключом: у бота нет сессии, а права уже проверены привязкой чата к учётке.
 */

type Admin = SupabaseClient<Database>;

/** Кого нашли по chat_id: этого достаточно, чтобы понять, что показывать. */
export type LinkedAccount = {
  userId: string;
  fullName: string;
  role: ProjectRole;
  onShift: boolean;
};

export async function findLinkedAccount(
  admin: Admin,
  projectId: string,
  chatId: string,
): Promise<LinkedAccount | null> {
  const { data } = await admin
    .from("telegram_accounts")
    .select("user_id, profiles!inner(full_name)")
    .eq("project_id", projectId)
    .eq("chat_id", chatId)
    .eq("status", "linked")
    .maybeSingle<{ user_id: string; profiles: { full_name: string } }>();

  if (!data) return null;

  const { data: member } = await admin
    .from("project_members")
    .select("role, on_shift")
    .eq("project_id", projectId)
    .eq("user_id", data.user_id)
    .eq("status", "active")
    .maybeSingle();

  if (!member) return null;

  return {
    userId: data.user_id,
    fullName: data.profiles.full_name,
    role: member.role as ProjectRole,
    onShift: member.on_shift ?? false,
  };
}

/** Переключает смену сотрудника из бота и возвращает новое состояние. */
export async function setShift(
  admin: Admin,
  projectId: string,
  userId: string,
  onShift: boolean,
): Promise<void> {
  await admin
    .from("project_members")
    .update({ on_shift: onShift })
    .eq("project_id", projectId)
    .eq("user_id", userId);
}

export type ConfirmedReceipt = { product: string | null; amount: number };

/**
 * Продажник прислал боту чек: привязываем его к своей последней продаже, ждущей
 * подтверждения, и помечаем чек полученным. Возвращает продажу или null, если
 * ждущей чек продажи нет (тогда бот так и ответит). Автопроверку суммы и CAPI —
 * позже; пока фиксируем сам факт чека.
 */
export async function confirmLatestReceipt(
  admin: Admin,
  projectId: string,
  userId: string,
  fileId: string,
): Promise<ConfirmedReceipt | null> {
  const { data: sale } = await admin
    .from("sales")
    .select("id, product, amount")
    .eq("project_id", projectId)
    .eq("seller_id", userId)
    .eq("receipt_status", "awaiting")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sale) return null;

  await admin
    .from("sales")
    .update({
      receipt_status: "confirmed",
      receipt_file_id: fileId,
      receipt_at: new Date().toISOString(),
    })
    .eq("id", sale.id);

  return { product: sale.product, amount: Number(sale.amount) };
}

export type PeriodCounters = {
  leads: number;
  qualified: number;
  trials: number;
  sales: number;
  revenue: number;
  /** Для продажника: пробные, назначенные ему и им проведённые за период. */
  trialsAssigned: number;
  trialsConducted: number;
};

export type BotMetrics = {
  role: ProjectRole;
  /** Считать ли по конкретному сотруднику или по всему проекту. */
  personal: boolean;
  today: PeriodCounters;
  month: PeriodCounters;
};

const EMPTY: PeriodCounters = {
  leads: 0,
  qualified: 0,
  trials: 0,
  sales: 0,
  revenue: 0,
  trialsAssigned: 0,
  trialsConducted: 0,
};

const QUALIFIED_PLUS = ["qualified", "trial_booked", "trial_done", "sale"];
const TRIAL_PLUS = ["trial_booked", "trial_done", "sale"];

async function countLeads(
  admin: Admin,
  projectId: string,
  userId: string | null,
  since: string | null,
  until: string | null,
): Promise<{ leads: number; qualified: number; trials: number }> {
  let query = admin
    .from("leads")
    .select("status")
    .eq("project_id", projectId);
  if (userId) query = query.eq("assigned_to", userId);
  if (since) query = query.gte("created_at", since);
  if (until) query = query.lt("created_at", until);

  const { data } = await query;
  const rows = data ?? [];
  return {
    leads: rows.length,
    qualified: rows.filter((r) => QUALIFIED_PLUS.includes(r.status)).length,
    trials: rows.filter((r) => TRIAL_PLUS.includes(r.status)).length,
  };
}

async function countSales(
  admin: Admin,
  projectId: string,
  userId: string | null,
  since: string | null,
  until: string | null,
): Promise<{ sales: number; revenue: number }> {
  let query = admin
    .from("sales")
    .select("amount")
    .eq("project_id", projectId);
  if (userId) query = query.eq("seller_id", userId);
  if (since) query = query.gte("created_at", since);
  if (until) query = query.lt("created_at", until);

  const { data } = await query;
  const rows = data ?? [];
  return {
    sales: rows.length,
    revenue: rows.reduce((sum, r) => sum + Number(r.amount), 0),
  };
}

/** Пробные продажника: назначенные ему и им проведённые за период (по дате оплаты пробного). */
async function countSalespersonTrials(
  admin: Admin,
  projectId: string,
  userId: string,
  since: string | null,
  until: string | null,
): Promise<{ trialsAssigned: number; trialsConducted: number }> {
  let query = admin
    .from("leads")
    .select("status")
    .eq("project_id", projectId)
    .eq("salesperson_id", userId)
    .not("trial_paid_at", "is", null);
  if (since) query = query.gte("trial_paid_at", since);
  if (until) query = query.lt("trial_paid_at", until);

  const { data } = await query;
  const rows = data ?? [];
  return {
    trialsAssigned: rows.length,
    trialsConducted: rows.filter((r) => r.status === "trial_done" || r.status === "sale").length,
  };
}

async function countPeriod(
  admin: Admin,
  projectId: string,
  userId: string | null,
  role: ProjectRole,
  from: string,
  to: string,
): Promise<PeriodCounters> {
  const { since, until } = createdAtBounds({ from, to });
  const [leadStats, saleStats, trialStats] = await Promise.all([
    countLeads(admin, projectId, userId, since, until),
    countSales(admin, projectId, userId, since, until),
    userId && role === "salesperson"
      ? countSalespersonTrials(admin, projectId, userId, since, until)
      : Promise.resolve({ trialsAssigned: 0, trialsConducted: 0 }),
  ]);
  return { ...leadStats, ...saleStats, ...trialStats };
}

/**
 * Менеджер и продажник видят свои цифры; РОП, директор и владелец — по проекту.
 * Роль определяет и то, какие строки бот подсветит в ответе.
 */
export async function loadBotMetrics(
  admin: Admin,
  projectId: string,
  userId: string,
  role: ProjectRole,
): Promise<BotMetrics> {
  const personal = role === "manager" || role === "salesperson";
  const scope = personal ? userId : null;

  const day = today();
  const monthStart = startOfMonth(day);

  const [todayCounters, monthCounters] = await Promise.all([
    countPeriod(admin, projectId, scope, role, day, day),
    countPeriod(admin, projectId, scope, role, monthStart, day),
  ]);

  return {
    role,
    personal,
    today: todayCounters ?? EMPTY,
    month: monthCounters ?? EMPTY,
  };
}
