import Link from "next/link";

import { DateRangePicker } from "@/components/date-range-picker";
import { GroupLabel, PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { CardSection } from "@/components/ui/card-section";
import { Icon } from "@/components/ui/icon";
import { StatStrip } from "@/components/metrics/stat-strip";
import { requireSectionAccess } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { readDateRange, today } from "@/lib/date-range";
import { ROLE_LABELS } from "@/lib/domain";
import { formatDate, formatDateRange, formatNumber, plural } from "@/lib/format";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadMembers } from "@/lib/queries/crm";
import { loadProjectReports, reportContent } from "@/lib/queries/reports";
import { REPORT_FIELDS } from "@/lib/reports";

/** Отчёты сотрудников — только директор и владелец (ТЗ, Блок 6). */
export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string; employee?: string }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const range = readDateRange(query);
  const employeeFilter = query.employee ?? "";

  const [, members, reports] = await Promise.all([
    requireSectionAccess(projectId, "reports"),
    loadMembers(projectId),
    loadProjectReports(projectId, range, employeeFilter || undefined),
  ]);

  const memberById = new Map(members.map((member) => [member.userId, member]));
  const activeMembers = members.filter((member) => member.status === "active");

  const currentDate = today();
  const reportedToday = new Set(
    reports.filter((report) => report.reportDate === currentDate).map((report) => report.authorId),
  );
  const authorsInRange = new Set(reports.map((report) => report.authorId));

  // Ссылка фильтра сохраняет выбранный период: иначе клик по сотруднику сбросит даты.
  function filterHref(userId: string): string {
    const next = new URLSearchParams();
    if (query.range) next.set("range", query.range);
    if (query.from) next.set("from", query.from);
    if (query.to) next.set("to", query.to);
    if (userId) next.set("employee", userId);
    const suffix = next.toString();
    return suffix ? `/p/${projectId}/reports?${suffix}` : `/p/${projectId}/reports`;
  }

  const missingToday = activeMembers.filter((member) => !reportedToday.has(member.userId));

  const stats = [
    { key: "total", label: "Отчётов за период", value: formatNumber(reports.length) },
    {
      key: "authors",
      label: "Сотрудников отчиталось",
      value: `${formatNumber(authorsInRange.size)} из ${formatNumber(activeMembers.length)}`,
    },
    {
      key: "today",
      label: "Сдали отчёт сегодня",
      value: formatNumber(reportedToday.size),
      hint: `${formatDate(currentDate)}`,
    },
    {
      key: "missing",
      label: "Не сдали сегодня",
      value: formatNumber(missingToday.length),
      hint:
        missingToday.length > 0
          ? missingToday.map((member) => member.fullName).join(", ")
          : "все отчитались",
      accent: missingToday.length === 0,
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("reports")}
        title="Отчёты"
        subtitle={`Ежедневные отчёты сотрудников проекта · ${formatDateRange(range.from, range.to)}`}
        actions={
          <DateRangePicker
            preset={range.preset}
            from={range.from}
            to={range.to}
            label={range.label}
          />
        }
      />

      <div className="mt-6">
        <StatStrip stats={stats} />
      </div>

      <GroupLabel>Сотрудник</GroupLabel>

      <nav className="flex flex-wrap gap-2" aria-label="Фильтр по сотруднику">
        <Link
          href={filterHref("")}
          className={cn(
            "inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] transition",
            employeeFilter === ""
              ? "border-brand bg-brand text-white"
              : "border-line bg-surface text-muted hover:border-brand-200 hover:text-brand-700",
          )}
        >
          Все сотрудники
        </Link>

        {members.map((member) => (
          <Link
            key={member.userId}
            href={filterHref(member.userId)}
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] transition",
              employeeFilter === member.userId
                ? "border-brand bg-brand text-white"
                : "border-line bg-surface text-muted hover:border-brand-200 hover:text-brand-700",
            )}
          >
            {member.fullName}
            <span
              className={cn(
                "text-[11px]",
                employeeFilter === member.userId ? "text-white/70" : "text-faint",
              )}
            >
              {ROLE_LABELS[member.role]}
              {member.status === "fired" ? " · уволен" : ""}
            </span>
          </Link>
        ))}
      </nav>

      <GroupLabel>Записи</GroupLabel>

      {reports.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-canvas text-muted">
            <Icon name="folder" className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-ink">За период отчётов нет</h3>
            <p className="mx-auto mt-1.5 max-w-[440px] text-[13px] leading-relaxed text-muted">
              Сотрудники заполняют их в разделе «Мой отчёт». Здесь собираются записи всей команды
              за выбранный период.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {reports.map((report) => {
            const author = memberById.get(report.authorId);
            const content = reportContent(report.content);
            const filled = REPORT_FIELDS.filter((field) => content[field.name]);

            return (
              <CardSection
                key={report.id}
                title={author?.fullName ?? "Сотрудник"}
                hint={author ? ROLE_LABELS[author.role] : undefined}
                icon="report"
                action={
                  <Badge tone={report.reportDate === currentDate ? "brand" : "muted"}>
                    {formatDate(report.reportDate)}
                  </Badge>
                }
              >
                {filled.length === 0 ? (
                  <p className="text-[13px] text-faint">Отчёт заполнен без текста.</p>
                ) : (
                  <dl className="flex flex-col gap-3">
                    {filled.map((field) => (
                      <div key={field.name}>
                        <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
                          {field.label}
                        </dt>
                        <dd className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-muted">
                          {content[field.name]}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </CardSection>
            );
          })}
        </div>
      )}

      {reports.length > 0 ? (
        <p className="mt-4 px-1 text-[12px] text-faint">
          Показано {formatNumber(reports.length)}{" "}
          {plural(reports.length, ["отчёт", "отчёта", "отчётов"])} за период.
        </p>
      ) : null}
    </main>
  );
}
