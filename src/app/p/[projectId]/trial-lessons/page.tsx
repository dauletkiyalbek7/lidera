import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { sectionBlockTitle } from "@/lib/navigation";
import { StatStrip } from "@/components/metrics/stat-strip";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { requireSectionAccess } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import { TRIAL_STATUS_FLOW, TRIAL_STATUS_LABELS, leadSourceLabel } from "@/lib/domain";
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { loadLeads, loadMembers } from "@/lib/queries/crm";
import type { Tables } from "@/lib/database.types";

const TRIAL_TONE = {
  trial_booked: "warning",
  trial_done: "brand",
  sale: "positive",
} as const;

/** Пробные уроки: записан → проведён → купил курс (ТЗ, Блок 2, ниша education). */
export default async function TrialLessonsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  // Контекст проекта и данные раздела независимы — уходят одной параллельной волной.
  const [, leads, members] = await Promise.all([
    requireSectionAccess(projectId, "trial-lessons"),
    loadLeads(projectId, range, { statuses: TRIAL_STATUS_FLOW }),
    loadMembers(projectId),
  ]);

  const memberNames = new Map(members.map((member) => [member.userId, member.fullName]));
  const booked = leads.length;
  const done = leads.filter((lead) => lead.status !== "trial_booked").length;
  const sold = leads.filter((lead) => lead.status === "sale").length;

  const stats = [
    { key: "booked", label: "Записались", value: formatNumber(booked), accent: true },
    {
      key: "done",
      label: "Пробный проведён",
      value: formatNumber(done),
      hint: `доходимость ${formatPercent(booked ? done / booked : null)}`,
    },
    {
      key: "sold",
      label: "Купили курс",
      value: formatNumber(sold),
      hint: `${formatPercent(done ? sold / done : null)} от проведённых`,
    },
    {
      key: "waiting",
      label: "Ждут пробного",
      value: formatNumber(booked - done),
    },
  ];

  const columns: Column<Tables<"leads">>[] = [
    {
      key: "name",
      header: "Ученик",
      render: (lead) => (
        <div className="flex flex-col">
          <span className="font-medium text-ink">{lead.full_name}</span>
          <span className="text-[11.5px] text-faint">{lead.phone ?? "телефон не указан"}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Статус",
      render: (lead) => (
        <Badge tone={TRIAL_TONE[lead.status as keyof typeof TRIAL_TONE] ?? "neutral"}>
          {TRIAL_STATUS_LABELS[lead.status] ?? lead.status}
        </Badge>
      ),
    },
    {
      key: "source",
      header: "Источник",
      hideOnMobile: true,
      render: (lead) => <span className="text-muted">{leadSourceLabel(lead.source)}</span>,
    },
    {
      key: "manager",
      header: "Записал менеджер",
      hideOnMobile: true,
      render: (lead) => (
        <span className="text-muted">
          {lead.assigned_to ? (memberNames.get(lead.assigned_to) ?? "Сотрудник") : "—"}
        </span>
      ),
    },
    {
      key: "seller",
      header: "Проводит продажник",
      hideOnMobile: true,
      render: (lead) => (
        <span className="text-muted">
          {lead.salesperson_id
            ? (memberNames.get(lead.salesperson_id) ?? "Сотрудник")
            : "не назначен"}
        </span>
      ),
    },
    {
      key: "when",
      header: "Когда пробный",
      align: "right",
      render: (lead) => (
        <span className="tabular text-muted">
          {lead.trial_at ? formatDateTime(lead.trial_at) : formatDate(lead.created_at)}
        </span>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("trial-lessons")}
        title="Пробные уроки"
        subtitle={`Записи на пробный · ${formatDateRange(range.from, range.to)}`}
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

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={leads}
          rowKey={(lead) => lead.id}
          empty={{
            icon: "trial",
            title: "За период записей нет",
            text: "Сюда попадают лиды со статусом «Записан на пробный» и дальше. Менеджер записывает, продажник проводит урок.",
          }}
        />
      </div>
    </main>
  );
}
