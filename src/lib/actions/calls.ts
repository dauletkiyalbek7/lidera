"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/queries/employees";
import { resolveAiKeys } from "@/lib/ai/keys";
import { analyzeCall, AiError } from "@/lib/ai/call-analysis";
import { loadCallRubric } from "@/lib/queries/call-rubric";
import type { Json } from "@/lib/database.types";

/** Оценивать звонки может руководитель отдела продаж и выше. */
function mayAnalyze(role: string, canManage: boolean): boolean {
  return canManage || role === "director" || role === "rop";
}

type Admin = ReturnType<typeof createSupabaseAdminClient>;

/** Прогоняет один звонок через AI и сохраняет результат. Не бросает наружу. */
async function analyzeAndSave(
  admin: Admin,
  projectId: string,
  callId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: call } = await admin
    .from("calls")
    .select("id, recording_url, duration_sec")
    .eq("project_id", projectId)
    .eq("id", callId)
    .maybeSingle();

  if (!call) return { ok: false, error: "Звонок не найден." };
  if (!call.recording_url) return { ok: false, error: "У звонка нет ссылки на запись." };

  await admin.from("calls").update({ status: "analyzing" }).eq("id", callId);

  const [keys, rubric] = await Promise.all([
    resolveAiKeys(projectId),
    loadCallRubric(projectId),
  ]);
  try {
    const result = await analyzeCall({
      recordingUrl: call.recording_url,
      durationSec: call.duration_sec,
      keys,
      rubric,
    });
    // В breakdown кладём и баллы, и обоснования, и рубрику на момент оценки —
    // чтобы разбор читался даже после правки правил проекта.
    const breakdown = {
      scores: result.breakdown,
      notes: result.notes,
      max: result.maxScore,
      criteria: rubric.criteria,
    };
    await admin
      .from("calls")
      .update({
        transcript: result.transcript,
        score: result.score,
        breakdown: breakdown as unknown as Json,
        summary: result.summary,
        status: "done",
        analyzed_at: new Date().toISOString(),
      })
      .eq("id", callId);
    return { ok: true };
  } catch (error) {
    await admin.from("calls").update({ status: "failed" }).eq("id", callId);
    const reason = error instanceof AiError ? error.message : "Не удалось проанализировать звонок.";
    return { ok: false, error: reason };
  }
}

export type AddCallState = { message: string | null; error: string | null };

/**
 * Ручное добавление записи звонка по ссылке и мгновенный разбор.
 * Пока внешняя CRM не подключена — это способ проверить «Анализ звонков»
 * на реальной записи (mp3/wav по URL).
 */
export async function addCallByUrl(
  _prev: AddCallState,
  formData: FormData,
): Promise<AddCallState> {
  const projectId = String(formData.get("project_id") ?? "");
  const recordingUrl = String(formData.get("recording_url") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const durationSec = Math.max(0, Math.round(Number(formData.get("duration_sec") ?? 0)) || 0);

  const { role, canManage, user } = await requireProjectContext(projectId);
  if (!mayAnalyze(role, canManage)) {
    return { message: null, error: "Анализировать звонки может РОП или директор." };
  }
  if (!hasServiceRoleKey()) return { message: null, error: "На сервере нет ключа для записи." };
  if (!/^https?:\/\//i.test(recordingUrl)) {
    return { message: null, error: "Укажите ссылку на запись (http/https)." };
  }

  const admin = createSupabaseAdminClient();
  const { data: call, error } = await admin
    .from("calls")
    .insert({
      project_id: projectId,
      recording_url: recordingUrl,
      phone,
      duration_sec: durationSec,
      status: "new",
    })
    .select("id")
    .single();

  if (error || !call) return { message: null, error: "Не удалось сохранить звонок." };

  await admin.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "call.added",
    details: { call_id: call.id },
  });

  const analyzed = await analyzeAndSave(admin, projectId, call.id);
  revalidatePath(`/p/${projectId}/call-analysis`);

  if (!analyzed.ok) {
    return { message: "Запись добавлена, но разбор не удался.", error: analyzed.error ?? null };
  }
  return { message: "Звонок добавлен и оценён.", error: null };
}

/** Повторный/ручной разбор существующего звонка (например, после сбоя). */
export async function analyzeCallAction(
  projectId: string,
  callId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { role, canManage } = await requireProjectContext(projectId);
  if (!mayAnalyze(role, canManage)) return { ok: false, error: "Нет прав." };
  if (!hasServiceRoleKey()) return { ok: false, error: "Нет ключа для записи." };

  const admin = createSupabaseAdminClient();
  const result = await analyzeAndSave(admin, projectId, callId);
  revalidatePath(`/p/${projectId}/call-analysis`);
  return result;
}
