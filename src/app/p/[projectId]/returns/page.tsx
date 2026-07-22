import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/metrics/metric-card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { requireSectionAccess } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import {
  currencySymbol,
  formatDate,
  formatDateRange,
  formatMoney,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { applyReturns, metricsFromRows } from "@/lib/metrics";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadMembers, loadRangeMetrics } from "@/lib/queries/crm";
import { loadReturnableSales, loadReturns, type ReturnRecord } from "@/lib/queries/returns";

import { CreateReturnDialog, type SaleOption } from "./create-return-dialog";

/** Возвраты (ТЗ, Блок 2). Оформляет РОП или директор, запись остаётся навсегда. */
export default async function ReturnsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  const [context, returns, members, metricsRows, returnableSales] = await Promise.all([
    requireSectionAccess(projectId, "returns"),
    loadReturns(projectId, range),
    loadMembers(projectId),
    loadRangeMetrics(projectId, range),
    loadReturnableSales(projectId),
  ]);

  const { project, role, canManage } = context;
  const currency = project.currency;
  const mayProcess = canManage || role === "director" || role === "rop";

  const returnsTotals = returns.reduce(
    (totals, row) => ({ count: totals.count + 1, amount: totals.amount + row.amount }),
    { count: 0, amount: 0 },
  );
  const metrics = applyReturns(metricsFromRows(metricsRows), returnsTotals);

  const memberNames = new Map(members.map((member) => [member.userId, member.fullName]));

  const saleOptions: SaleOption[] = returnableSales.map((sale) => ({
    id: sale.id,
    label: `${sale.product ?? "Продажа"} · ${formatMoney(sale.amount, currency)} · ${formatDate(sale.createdAt)}`,
    remaining: Math.round(sale.remaining),
    remainingLabel: formatMoney(sale.remaining, currency),
  }));

  const cards = [
    {
      key: "count",
      label: "Возвратов за период",
      icon: "returns" as const,
      value: formatNumber(metrics.returnsCount),
    },
    {
      key: "amount",
      label: "Сумма возвратов",
      icon: "money" as const,
      value: formatMoney(metrics.returnsAmount, currency),
    },
    {
      key: "net_revenue",
      label: "Доход за вычетом возвратов",
      icon: "wallet" as const,
      value: formatMoney(metrics.netRevenue, currency),
      hint: `начислено ${formatMoney(metrics.revenue, currency)}`,
      accent: true,
    },
    {
      key: "rate",
      label: "Доля возвратов",
      icon: "chart" as const,
      value: formatPercent(metrics.refundRate),
      hint: "от дохода периода",
    },
  ];

  const columns: Column<ReturnRecord>[] = [
    {
      key: "product",
      header: "Продажа",
      render: (row) => (
        <div>
          <span className="font-medium text-ink">{row.product ?? "Без названия"}</span>
          {row.saleDate ? (
            <span className="mt-0.5 block text-[11.5px] text-faint">
              продана {formatDate(row.saleDate)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "reason",
      header: "Причина",
      hideOnMobile: true,
      render: (row) => (
        <span className="text-muted">{row.reason ?? "Не указана"}</span>
      ),
    },
    {
      key: "processed_by",
      header: "Оформил",
      hideOnMobile: true,
      render: (row) => (
        <span className="text-muted">
          {row.processedBy ? (memberNames.get(row.processedBy) ?? "Владелец") : "—"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Дата возврата",
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular text-muted">{formatDate(row.createdAt)}</span>
      ),
    },
    {
      key: "amount",
      header: "Сумма",
      align: "right",
      render: (row) => (
        <span className="tabular font-semibold text-negative">
          −{formatMoney(row.amount, currency)}
          {row.saleAmount !== null && row.amount < row.saleAmount ? (
            <span className="mt-0.5 block text-[11.5px] font-normal text-faint">
              частичный, из {formatMoney(row.saleAmount, currency)}
            </span>
          ) : null}
        </span>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("returns")}
        title="Возвраты"
        subtitle={`Оформляет РОП или директор · ${formatDateRange(range.from, range.to)}`}
        actions={
          <>
            <DateRangePicker
              preset={range.preset}
              from={range.from}
              to={range.to}
              label={range.label}
            />
            {mayProcess ? (
              <CreateReturnDialog
                projectId={projectId}
                sales={saleOptions}
                currencyLabel={currencySymbol(currency)}
              />
            ) : null}
          </>
        }
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <MetricCard
            key={card.key}
            label={card.label}
            value={card.value}
            hint={"hint" in card ? card.hint : undefined}
            icon={card.icon}
            accent={"accent" in card ? card.accent : false}
          />
        ))}
      </section>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={returns}
          rowKey={(row) => row.id}
          empty={{
            icon: "returns",
            title: "За период возвратов нет",
            text: mayProcess
              ? "Оформите возврат по продаже — сумма вычтется из дохода и прибыли того периода, в котором вернули деньги."
              : "Возвраты оформляют РОП и директор проекта.",
          }}
        />
      </div>
    </main>
  );
}
