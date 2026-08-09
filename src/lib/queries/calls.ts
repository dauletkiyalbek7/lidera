import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createdAtBounds, type DateRange } from "@/lib/date-range";
import type { Tables } from "@/lib/database.types";

/** Звонки проекта за период — для раздела «Анализ звонков». Ограничено RLS. */
export async function loadCalls(
  projectId: string,
  range: DateRange,
): Promise<Tables<"calls">[]> {
  const supabase = await createSupabaseServerClient();
  const { since, until } = createdAtBounds(range);

  let query = supabase
    .from("calls")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (since) query = query.gte("created_at", since);
  if (until) query = query.lt("created_at", until);

  const { data } = await query;
  return data ?? [];
}
