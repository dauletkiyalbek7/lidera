"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LEAD_STATUS_FLOW } from "@/lib/domain";

/**
 * Смена этапа лида. Пока доступна владельцу проекта:
 * точечные права менеджера и продажника добавим вместе с правами доступа (Этап 5).
 */
export async function updateLeadStatus(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const leadId = String(formData.get("lead_id") ?? "");
  const status = String(formData.get("status") ?? "");

  const { niche, canManage, user } = await requireProjectContext(projectId);
  if (!canManage) return;
  if (!LEAD_STATUS_FLOW[niche].includes(status)) return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("leads")
    .update({ status })
    .eq("id", leadId)
    .eq("project_id", projectId);

  if (error) return;

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "lead.status_changed",
    details: { lead_id: leadId, status },
  });

  revalidatePath(`/p/${projectId}/leads`);
  revalidatePath(`/p/${projectId}/crm-funnel`);
}
