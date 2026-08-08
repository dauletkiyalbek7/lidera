import Link from "next/link";

import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { sectionBlockTitle } from "@/lib/navigation";
import { StatStrip } from "@/components/metrics/stat-strip";
import { LeadStatusBadge } from "@/components/crm/lead-status-badge";
import { LeadStatusSelect } from "@/components/crm/lead-status-select";
import { Avatar } from "@/components/ui/avatar";
import { DataTable, type Column } from "@/components/ui/data-table";
import { stageOf } from "@/lib/crm-stage";
import { requireSectionAccess } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import { LEAD_STATUS_FLOW, leadSourceLabel } from "@/lib/domain";
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import {
  loadCreativeLabels,
  loadCreativeOptions,
  loadCreativePickerOptions,
  loadLeads,
  loadMembers,
} from "@/lib/queries/crm";
import type { Tables } from "@/lib/database.types";

import { LeadOps } from "./lead-ops";
import { BookTrialCell } from "./book-trial";
import { AddLeadButton } from "./add-lead";
import { LeadCreativePicker } from "./lead-creative-picker";

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
  const [
    { project, niche, canManage, role, user },
    leads,
    members,
    creativeOptions,
    creativePickOptions,
  ] = await Promise.all([
    requireSectionAccess(projectId, "leads"),
    loadLeads(projectId, range),
    loadMembers(projectId),
    loadCreativeOptions(projectId),
    loadCreativePickerOptions(projectId),
  ]);

  const memberNames = new Map(members.map((member) => [member.userId, member.fullName]));

  // Названия креативов для лидов — чтобы показать, с какого объявления пришёл лид.
  const creativeLabels = await loadCreativeLabels(
    projectId,
    leads.map((lead) => lead.creative_id).filter((id): id is string => Boolean(id)),
  );

  // Раздача касается только образования: там есть менеджеры и очередь лидов.
  const mayDistribute = canManage || role === "director" || role === "rop";
  const me = members.find((member) => member.userId === user.id);
  const isManager = me?.role === "manager";
  const unassignedNew = leads.filter(
    (lead) => !lead.assigned_to && lead.status === "new",
  ).length;
  const showOps = niche === "education" && (mayDistribute || isManager);
  // Завести лид руками (WhatsApp) может руководитель или менеджер.
  const mayAddLead = mayDistribute || isManager;
  const flow = LEAD_STATUS_FLOW[niche];

  // Записать на пробный может руководитель (любой лид) или менеджер (свой лид).
  const trialPrice = Number(project.trial_price ?? 990);
  const bookable = (lead: Tables<"leads">) =>
    (lead.status === "new" || lead.status === "qualified") &&
    (mayDistribute || (isManager && lead.assigned_to === user.id));

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
      render: (lead) => {
        const stage = stageOf(lead.status);
        return (
          <div className="flex items-center gap-3">
            <Avatar name={lead.full_name} soft={stage.soft} text={stage.text} />
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium text-ink">{lead.full_name}</span>
              <span className="tabular text-[11.5px] text-faint">
                {lead.phone ?? "телефон не указан"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: "source",
      header: "Источник",
      hideOnMobile: true,
      render: (lead) => <span className="text-muted">{leadSourceLabel(lead.source)}</span>,
    },
    {
      key: "creative",
      header: "Креатив",
      hideOnMobile: true,
      render: (lead) => {
        // Кто может заводить лиды — тому даём выбрать креатив вручную любым списком.
        if (mayAddLead) {
          return (
            <LeadCreativePicker
              projectId={projectId}
              leadId={lead.id}
              currentId={lead.creative_id}
              currency={project.currency}
              options={creativePickOptions}
            />
          );
        }
        const creative = lead.creative_id ? creativeLabels.get(lead.creative_id) : null;
        if (!creative) return <span className="text-faint">—</span>;
        return (
          <Link
            href={`/p/${projectId}/creatives-analytics?focus=${lead.creative_id}`}
            className="group flex flex-col"
            title="Открыть аналитику креатива"
          >
            <span className="text-brand-700 transition group-hover:text-brand">
              {creative.label ?? creative.name}
            </span>
            {creative.label && creative.name !== creative.label ? (
              <span className="text-[11px] text-faint">{creative.name}</span>
            ) : null}
          </Link>
        );
      },
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
    ...(showOps
      ? [
          {
            key: "trial",
            header: "Пробный урок",
            hideOnMobile: true,
            render: (lead: Tables<"leads">) => {
              if (bookable(lead)) {
                return (
                  <BookTrialCell
                    projectId={projectId}
                    leadId={lead.id}
                    trialPrice={trialPrice}
                    currency={project.currency}
                  />
                );
              }
              if (lead.trial_at) {
                const seller = lead.salesperson_id
                  ? memberNames.get(lead.salesperson_id)
                  : null;
                return (
                  <div className="flex flex-col">
                    <span className="tabular text-muted">{formatDateTime(lead.trial_at)}</span>
                    <span className="text-[11px] text-faint">
                      {seller ? `Продажник: ${seller}` : "Ждёт продажника"}
                    </span>
                  </div>
                );
              }
              return <span className="text-faint">—</span>;
            },
          },
        ]
      : []),
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
          <div className="flex flex-wrap items-center justify-end gap-2">
            {mayAddLead ? (
              <AddLeadButton projectId={projectId} creatives={creativeOptions} />
            ) : null}
            {showOps ? (
              <LeadOps
                projectId={projectId}
                mayDistribute={mayDistribute}
                unassigned={unassignedNew}
                isManager={Boolean(isManager)}
                onShift={me?.onShift ?? false}
              />
            ) : null}
            <DateRangePicker
              preset={range.preset}
              from={range.from}
              to={range.to}
              label={range.label}
            />
          </div>
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
