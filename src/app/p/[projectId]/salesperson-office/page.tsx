import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { sectionBlockTitle } from "@/lib/navigation";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { requireSectionAccess } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import {
  formatDateRange,
  formatDateTime,
  formatMoney,
  formatMoneyOrDash,
  formatNumber,
} from "@/lib/format";
import { loadMembers, loadSales, loadTrialQueue } from "@/lib/queries/crm";
import type { Tables } from "@/lib/database.types";

import { ShiftToggle, TrialDoneButton } from "./office-ops";

type SalespersonRow = {
  id: string;
  name: string;
  fired: boolean;
  sales: number;
  amount: number;
};

/** Кабинет продажника: очередь пробных, закрытые продажи курса и показатели (ТЗ, Блок 2). */
export default async function SalespersonOfficePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  const { project, role, canManage, user } = await requireSectionAccess(
    projectId,
    "salesperson-office",
  );

  const ownView = role === "salesperson";
  const overseer = canManage || role === "director" || role === "rop";

  // Продажник видит свою очередь; руководитель — все пробные проекта.
  const [sales, members, trials] = await Promise.all([
    loadSales(projectId, range),
    loadMembers(projectId),
    loadTrialQueue(projectId, ownView ? { salespersonId: user.id } : {}),
  ]);

  const currency = project.currency;
  const memberNames = new Map(members.map((member) => [member.userId, member.fullName]));
  const me = members.find((member) => member.userId === user.id);

  const salespeople = members.filter(
    (member) => member.role === "salesperson" && (!ownView || member.userId === user.id),
  );

  const rows: SalespersonRow[] = salespeople
    .map((person) => {
      const own = sales.filter((sale) => sale.seller_id === person.userId);
      return {
        id: person.userId,
        name: person.fullName,
        fired: person.status === "fired",
        sales: own.length,
        amount: own.reduce((sum, sale) => sum + Number(sale.amount), 0),
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const canMarkDone = (trial: Tables<"leads">) =>
    overseer || (ownView && trial.salesperson_id === user.id);

  const trialColumns: Column<Tables<"leads">>[] = [
    {
      key: "name",
      header: "Ученик",
      render: (trial) => (
        <div className="flex flex-col">
          <span className="font-medium text-ink">{trial.full_name}</span>
          <span className="text-[11.5px] text-faint">{trial.phone ?? "телефон не указан"}</span>
        </div>
      ),
    },
    {
      key: "when",
      header: "Когда",
      render: (trial) => (
        <span className="tabular text-muted">
          {trial.trial_at ? formatDateTime(trial.trial_at) : "время не задано"}
        </span>
      ),
    },
    {
      key: "manager",
      header: "Записал менеджер",
      hideOnMobile: true,
      render: (trial) => (
        <span className="text-muted">
          {trial.assigned_to ? (memberNames.get(trial.assigned_to) ?? "Сотрудник") : "—"}
        </span>
      ),
    },
    ...(ownView
      ? []
      : [
          {
            key: "seller",
            header: "Продажник",
            hideOnMobile: true,
            render: (trial: Tables<"leads">) => (
              <span className="text-muted">
                {trial.salesperson_id
                  ? (memberNames.get(trial.salesperson_id) ?? "Сотрудник")
                  : "не назначен"}
              </span>
            ),
          },
        ]),
    {
      key: "action",
      header: "",
      align: "right",
      render: (trial) =>
        canMarkDone(trial) ? (
          <TrialDoneButton projectId={projectId} leadId={trial.id} />
        ) : null,
    },
  ];

  const columns: Column<SalespersonRow>[] = [
    {
      key: "name",
      header: "Продажник",
      render: (row) => (
        <span className="flex items-center gap-2">
          <span className="font-medium text-ink">{row.name}</span>
          {row.fired ? <Badge tone="muted">Уволен</Badge> : null}
        </span>
      ),
    },
    {
      key: "sales",
      header: "Продажи курса",
      align: "right",
      render: (row) => <span className="tabular text-muted">{formatNumber(row.sales)}</span>,
    },
    {
      key: "average",
      header: "Средний чек",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular text-muted">
          {formatMoneyOrDash(row.sales ? row.amount / row.sales : null, currency)}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Сумма продаж",
      align: "right",
      render: (row) => (
        <span className="tabular font-semibold text-ink">
          {formatMoney(row.amount, currency)}
        </span>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("salesperson-office")}
        title="Кабинет продажника"
        subtitle={
          ownView
            ? `Мои пробные и продажи · ${formatDateRange(range.from, range.to)}`
            : `Продажники проекта · ${formatDateRange(range.from, range.to)}`
        }
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {ownView && me ? <ShiftToggle projectId={projectId} onShift={me.onShift} /> : null}
            <DateRangePicker
              preset={range.preset}
              from={range.from}
              to={range.to}
              label={range.label}
            />
          </div>
        }
      />

      <section className="mt-6">
        <div className="mb-2 flex items-baseline justify-between px-1">
          <h2 className="text-[15px] font-semibold text-ink">
            {ownView ? "Мои пробные уроки" : "Очередь пробных уроков"}
          </h2>
          <span className="text-[12px] text-faint">
            {formatNumber(trials.length)} к проведению
          </span>
        </div>
        <DataTable
          columns={trialColumns}
          rows={trials}
          rowKey={(trial) => trial.id}
          empty={{
            icon: "trial",
            title: "Пробных к проведению нет",
            text: "Сюда попадают записанные пробные уроки. Менеджер записывает и оплачивает пробный — он падает свободному продажнику по кругу с датой и временем.",
          }}
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-2 px-1 text-[15px] font-semibold text-ink">Показатели по продажам</h2>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty={{
            icon: "office",
            title: "Продажников пока нет",
            text: "Сотрудники добавляются в «Настройки → Сотрудники». Показатели считаются по продажам, закрытым этим сотрудником.",
          }}
        />
      </section>
    </main>
  );
}
