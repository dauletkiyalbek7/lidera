import { PageHeader } from "@/components/layout/page-header";
import { sectionBlockTitle } from "@/lib/navigation";
import { CardSection } from "@/components/ui/card-section";
import { Icon } from "@/components/ui/icon";
import { requireSectionAccess } from "@/lib/auth";
import { today } from "@/lib/date-range";
import { formatDate } from "@/lib/format";
import { reportContent } from "@/lib/queries/reports";
import { REPORT_FIELDS } from "@/lib/reports";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { ReportForm } from "./report-form";

const HISTORY_LIMIT = 20;

/** Мой отчёт: сотрудник заполняет свой день и видит только свои записи (ТЗ, Блок 1). */
export default async function MyReportPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { user } = await requireSectionAccess(projectId, "my-report");
  const supabase = await createSupabaseServerClient();

  const { data: reports } = await supabase
    .from("employee_reports")
    .select("id, report_date, content, created_at")
    .eq("project_id", projectId)
    .eq("author_id", user.id)
    .order("report_date", { ascending: false })
    .limit(HISTORY_LIMIT);

  const currentDate = today();
  const todaysReport = (reports ?? []).find((report) => report.report_date === currentDate);

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("my-report")}
        title="Мой отчёт"
        subtitle={`${user.fullName} · отчёт за ${formatDate(currentDate)}`}
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <ReportForm
          projectId={projectId}
          defaultDate={currentDate}
          defaultValues={reportContent(todaysReport?.content)}
        />

        <CardSection
          title="Мои отчёты"
          hint={`Последние ${HISTORY_LIMIT} записей. Их видите только вы и директор проекта.`}
          icon="report"
        >
          {(reports ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[12px] bg-canvas px-4 py-8 text-center">
              <Icon name="report" className="h-5 w-5 text-faint" />
              <p className="text-[12.5px] leading-relaxed text-faint">
                Отчётов пока нет. Заполните первый — он появится в этом списке.
              </p>
            </div>
          ) : (
            <ol className="flex flex-col">
              {(reports ?? []).map((report) => {
                const content = reportContent(report.content);
                return (
                  <li key={report.id} className="border-b border-line py-3.5 last:border-b-0">
                    <p className="text-[13px] font-medium text-ink">
                      {formatDate(report.report_date)}
                      {report.report_date === currentDate ? (
                        <span className="ml-2 text-[11px] font-normal text-brand-700">
                          сегодня
                        </span>
                      ) : null}
                    </p>
                    <dl className="mt-1.5 flex flex-col gap-1">
                      {REPORT_FIELDS.filter((field) => content[field.name]).map((field) => (
                        <div key={field.name}>
                          <dt className="text-[11px] text-faint">{field.label}</dt>
                          <dd className="text-[12.5px] leading-relaxed text-muted">
                            {content[field.name]}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </li>
                );
              })}
            </ol>
          )}
        </CardSection>
      </div>
    </main>
  );
}
