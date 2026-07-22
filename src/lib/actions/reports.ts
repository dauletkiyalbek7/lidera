"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isIsoDate, today } from "@/lib/date-range";
import { REPORT_FIELDS } from "@/lib/reports";

export type ReportFormState = { error: string | null; saved: boolean };


export async function saveEmployeeReport(
  _prevState: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  const projectId = String(formData.get("project_id") ?? "");
  const { user } = await requireProjectContext(projectId);

  const reportDate = String(formData.get("report_date") ?? "");
  if (!isIsoDate(reportDate)) {
    return { error: "Укажите дату отчёта.", saved: false };
  }
  if (reportDate > today()) {
    return { error: "Отчёт нельзя поставить на будущую дату.", saved: false };
  }

  const content = Object.fromEntries(
    REPORT_FIELDS.map((field) => [field.name, String(formData.get(field.name) ?? "").trim()]),
  );

  if (!content.done) {
    return { error: "Заполните, что сделано за день.", saved: false };
  }

  const supabase = await createSupabaseServerClient();

  // На одну дату — один отчёт: повторное сохранение обновляет запись.
  const { data: existing } = await supabase
    .from("employee_reports")
    .select("id")
    .eq("project_id", projectId)
    .eq("author_id", user.id)
    .eq("report_date", reportDate)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("employee_reports").update({ content }).eq("id", existing.id)
    : await supabase.from("employee_reports").insert({
        project_id: projectId,
        author_id: user.id,
        report_date: reportDate,
        content,
      });

  if (error) {
    return { error: "Не удалось сохранить отчёт. Попробуйте ещё раз.", saved: false };
  }

  revalidatePath(`/p/${projectId}/my-report`);
  return { error: null, saved: true };
}
