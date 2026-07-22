import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/date-range";

/** Отчёты сотрудников (ТЗ, Блок 6). Директор видит все записи своего проекта. */

export type ProjectReport = {
  id: string;
  authorId: string;
  reportDate: string;
  content: unknown;
  createdAt: string;
};

const REPORTS_LIMIT = 200;

/**
 * Отчёты проекта за период.
 * Фильтр по сотруднику необязателен: без него отдаём всю команду.
 */
export async function loadProjectReports(
  projectId: string,
  range: DateRange,
  authorId?: string,
): Promise<ProjectReport[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("employee_reports")
    .select("id, author_id, report_date, content, created_at")
    .eq("project_id", projectId)
    .order("report_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(REPORTS_LIMIT);

  // report_date — обычная дата, поэтому границы периода берём как есть.
  if (range.from) query = query.gte("report_date", range.from);
  if (range.to) query = query.lte("report_date", range.to);
  if (authorId) query = query.eq("author_id", authorId);

  const { data } = await query;

  return (data ?? []).map((row) => ({
    id: row.id,
    authorId: row.author_id,
    reportDate: row.report_date,
    content: row.content,
    createdAt: row.created_at,
  }));
}

/** content лежит в jsonb: приводим к строкам, чтобы разметка не падала на чужой форме. */
export function reportContent(content: unknown): Record<string, string> {
  if (!content || typeof content !== "object") return {};
  return Object.fromEntries(
    Object.entries(content as Record<string, unknown>).map(([key, value]) => [
      key,
      typeof value === "string" ? value : "",
    ]),
  );
}
