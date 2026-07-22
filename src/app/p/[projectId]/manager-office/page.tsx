import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { sectionBlockTitle } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { requireSectionAccess } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import { LEAD_STATUS_FLOW } from "@/lib/domain";
import { formatDateRange, formatNumber, formatPercent } from "@/lib/format";
import { loadLeads, loadMembers } from "@/lib/queries/crm";

type ManagerRow = {
  id: string;
  name: string;
  fired: boolean;
  leads: number;
  qualified: number;
  trials: number;
  sales: number;
};

/** Кабинет менеджера: лиды, записанные пробные, показатели (ТЗ, Блок 2). */
export default async function ManagerOfficePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  // Контекст проекта и данные раздела независимы — уходят одной параллельной волной.
  const [{ niche, role, user }, leads, members] = await Promise.all([
    requireSectionAccess(projectId, "manager-office"),
    loadLeads(projectId, range),
    loadMembers(projectId),
  ]);

  const flow = LEAD_STATUS_FLOW[niche];
  const ownView = role === "manager";
  const managers = members.filter(
    (member) => member.role === "manager" && (!ownView || member.userId === user.id),
  );

  const rows: ManagerRow[] = managers
    .map((manager) => {
      const own = leads.filter((lead) => lead.assigned_to === manager.userId);
      return {
        id: manager.userId,
        name: manager.fullName,
        fired: manager.status === "fired",
        leads: own.length,
        qualified: own.filter((lead) => flow.indexOf(lead.status) >= 1).length,
        trials: own.filter((lead) => flow.indexOf(lead.status) >= 2).length,
        sales: own.filter((lead) => lead.status === "sale").length,
      };
    })
    .sort((a, b) => b.trials - a.trials || b.leads - a.leads);

  const columns: Column<ManagerRow>[] = [
    {
      key: "name",
      header: "Менеджер",
      render: (row) => (
        <span className="flex items-center gap-2">
          <span className="font-medium text-ink">{row.name}</span>
          {row.fired ? <Badge tone="muted">Уволен</Badge> : null}
        </span>
      ),
    },
    {
      key: "leads",
      header: "Лиды",
      align: "right",
      render: (row) => <span className="tabular text-muted">{formatNumber(row.leads)}</span>,
    },
    {
      key: "qualified",
      header: "Квалифицировано",
      align: "right",
      hideOnMobile: true,
      render: (row) => <span className="tabular text-muted">{formatNumber(row.qualified)}</span>,
    },
    {
      key: "trials",
      header: "Записал на пробный",
      align: "right",
      render: (row) => (
        <span className="tabular font-semibold text-ink">{formatNumber(row.trials)}</span>
      ),
    },
    {
      key: "conversion",
      header: "Лид → пробный",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular text-muted">
          {formatPercent(row.leads ? row.trials / row.leads : null)}
        </span>
      ),
    },
    {
      key: "sales",
      header: "Дошли до покупки",
      align: "right",
      hideOnMobile: true,
      render: (row) => <span className="tabular text-muted">{formatNumber(row.sales)}</span>,
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("manager-office")}
        title="Кабинет менеджера"
        subtitle={
          ownView
            ? `Мои показатели · ${formatDateRange(range.from, range.to)}`
            : `Менеджеры проекта · ${formatDateRange(range.from, range.to)}`
        }
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
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty={{
            icon: "office",
            title: "Менеджеров пока нет",
            text: "Сотрудники добавляются в «Настройки → Сотрудники». После назначения на лиды здесь появятся их показатели.",
          }}
        />
      </div>

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-faint">
        Менеджер квалифицирует лид и записывает его на пробный урок. Проводит урок и закрывает
        продажу курса уже продажник — его показатели в разделе «Кабинет продажника».
      </p>
    </main>
  );
}
