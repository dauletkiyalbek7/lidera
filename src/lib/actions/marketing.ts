"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { asRangePreset } from "@/lib/date-range";
import { LEAD_SOURCE_LABELS } from "@/lib/domain";

const MAX_NAME = 60;

function mayManage(role: string, canManage: boolean): boolean {
  return canManage || role === "director";
}

/** Сохранение рабочей воронки: именованный срез по источнику, креативу и периоду. */
export async function saveFunnel(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!mayManage(role, canManage)) return;

  const name = String(formData.get("name") ?? "").trim().slice(0, MAX_NAME);
  if (name.length < 2) return;

  const source = String(formData.get("source") ?? "");
  const creativeId = String(formData.get("creative_id") ?? "");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("saved_funnels").upsert(
    {
      project_id: projectId,
      name,
      source: source && source in LEAD_SOURCE_LABELS ? source : null,
      creative_id: creativeId || null,
      range_preset: asRangePreset(String(formData.get("range") ?? "")),
      created_by: user.id,
    },
    { onConflict: "project_id,name" },
  );

  if (error) return;

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "funnel.saved",
    details: { name },
  });

  revalidatePath(`/p/${projectId}/marketing-dashboard`);
}

export async function deleteFunnel(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const funnelId = String(formData.get("funnel_id") ?? "");

  const { role, canManage } = await requireProjectContext(projectId);
  if (!mayManage(role, canManage)) return;

  const supabase = await createSupabaseServerClient();
  await supabase.from("saved_funnels").delete().eq("id", funnelId).eq("project_id", projectId);

  revalidatePath(`/p/${projectId}/marketing-dashboard`);
}
