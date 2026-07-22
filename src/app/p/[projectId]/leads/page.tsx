import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { sectionBlockTitle } from "@/lib/navigation";
import { StatStrip } from "@/components/metrics/stat-strip";
import { LeadStatusBadge } from "@/components/crm/lead-status-badge";
import { LeadStatusSelect } from "@/components/crm/lead-status-select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { requireSectionAccess } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import { LEAD_STATUS_FLOW, leadSourceLabel } from "@/lib/domain";
import { formatDate, formatDateRange, formatNumber, formatPercent } from "@/lib/format";
import { loadLeads, loadMembers } from "@/lib/queries/crm";
import type { Tables } from "@/lib/database.types";

/** Лиды: сколько пришло, что с ними стало, кто ответственный (ТЗ, Блок 2). */
export default async function LeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  // Контекст проекта и данные раздела независимы — уходят одной параллельной волной.
  const [{ niche, canManage }, leads, members] = await Promise.all([
    requireSectionAccess(projectId, "leads"),
    loadLeads(projectId, range),
    loadMembers(projectId),
  ]);

  const memberNames = new Map(members.map((member) => [member.userId, member.fullName]));
  const flow = LEAD_STATUS_FLOW[niche];

  const countFrom = (index: number) =>
    leads.filter((lead) => flow.indexOf(lead.status) >= index).length;

  const total = leads.length;
  const processed = countFrom(1);
  const sold = leads.filter((lead) => lead.status === "sale").length;

  const stats =
    niche === "education"
      ? [
          { key: "total", label: "Всего лидов", value: formatNumber(total), accent: true },
          {
            key: "qualified",
            label: "Квалифицировано",
            value: formatNumber(processed),
            hint: `${formatPercent(total ? processed / total : null)} от лидов`,
          },
          {
            key: "trial",
            label: "Записались на пробный",
            value: formatNumber(countFrom(2)),
            hint: `${formatPercent(total ? countFrom(2) / total : null)} от лидов`,
          },
          {
            key: "sale",
            label: "Купили курс",
            value: formatNumber(sold),
            hint: `${formatPercent(total ? sold / total : null)} конверсия`,
          },
        ]
      : [
          { key: "total", label: "Всего лидов", value: formatNumber(total), accent: true },
          {
            key: "processed",
            label: "Обработано",
            value: formatNumber(processed),
            hint: `${formatPercent(total ? processed / total : null)} от лидов`,
          },
          {
            key: "sale",
            label: "Продажи",
            value: formatNumber(sold),
            hint: `${formatPercent(total ? sold / total : null)} конверсия`,
          },
          {
            key: "new",
            label: "Ещё в работе",
            value: formatNumber(total - sold),
          },
        ];

  const columns: Column<Tables<"leads">>[] = [
    {
      key: "name",
      header: "Лид",
      render: (lead) => (
        <div className="flex flex-col">
          <span className="font-medium text-ink">{lead.full_name}</span>
          <span className="text-[11.5px] text-faint">{lead.phone ?? "телефон не указан"}</span>
        </div>
      ),
    },
    {
      key: "source",
      header: "Источник",
      hideOnMobile: true,
      render: (lead) => <span className="text-muted">{leadSourceLabel(lead.source)}</span>,
    },
    {
      key: "status",
      header: "Этап",
      render: (lead) =>
        canManage ? (
          <LeadStatusSelect
            projectId={projectId}
            leadId={lead.id}
            status={lead.status}
            statuses={flow}
          />
        ) : (
          <LeadStatusBadge status={lead.status} />
        ),
    },
    {
      key: "assigned",
      header: "Ответственный",
      hideOnMobile: true,
      render: (lead) => (
        <span className="text-muted">
          {lead.assigned_to ? (memberNames.get(lead.assigned_to) ?? "Сотрудник") : "—"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Пришёл",
      align: "right",
      render: (lead) => (
        <span className="tabular text-muted">{formatDate(lead.created_at)}</span>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("leads")}
        title="Лиды"
        subtitle={`Входящие заявки · ${formatDateRange(range.from, range.to)}`}
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
            icon: "leads",
            title: "За период лидов нет",
            text: "Выберите другой период или заполните проект демо-данными на Главной. Позже лиды будут приходить из рекламных кабинетов и чат-бота автоматически.",
          }}
        />
      </div>
    </main>
  );
}
