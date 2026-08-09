import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeRubric, type CallRubric } from "@/lib/call-rubric";

/** Правила оценки звонков проекта (или дефолт, если не заданы). */
export async function loadCallRubric(projectId: string): Promise<CallRubric> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("projects")
    .select("call_rubric")
    .eq("id", projectId)
    .maybeSingle();
  return normalizeRubric(data?.call_rubric);
}
