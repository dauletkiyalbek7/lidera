import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { sectionBlockTitle } from "@/lib/navigation";
import { MetricCard } from "@/components/metrics/metric-card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { requireSectionAccess } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import {
  formatDate,
  formatDateRange,
  formatMoney,
  formatMoneyOrDash,
  formatNumber,
  formatPercent,
  plural,
} from "@/lib/format";
import { applyReturns, metricsFromRows } from "@/lib/metrics";
import { loadMembers, loadRangeMetrics, loadSales } from "@/lib/queries/crm";
import { loadReturnsTotals } from "@/lib/queries/returns";
import type { Tables } from "@/lib/database.types";

/** Продажи: деньги периода и список сделок (ТЗ, Блок 2). */
export default async function SalesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  // Контекст проекта и данные раздела независимы — уходят одной параллельной волной.
  const [{ project, niche }, sales, members, metricsRows, returnsTotals] = await Promise.all([
    requireSectionAccess(projectId, "sales"),
    loadSales(projectId, range),
    loadMembers(projectId),
    loadRangeMetrics(projectId, range),
    loadReturnsTotals(projectId, range),
  ]);

  // Возвраты вычитаются из дохода периода: прибыль и средний чек должны быть честными.
  const metrics = applyReturns(metricsFromRows(metricsRows), returnsTotals);
  const memberNames = new Map(members.map((member) => [member.userId, member.fullName]));
  const currency = project.currency;

  const cards = [
    {
      key: "revenue",
      label: "Доход",
      icon: "money" as const,
      value: formatMoney(metrics.revenue, currency),
      accent: true,
    },
    {
      key: "ad_spend",
      label: "Расходы на рекламу",
      icon: "ads" as const,
      value: formatMoney(metrics.adSpend, currency),
    },
    // Карточка возвратов появляется, только когда возвраты были: иначе она пустой шум.
    ...(metrics.returnsCount > 0
      ? [
          {
            key: "returns",
            label: "Возвраты",
            icon: "returns" as const,
            value: `−${formatMoney(metrics.returnsAmount, currency)}`,
            hint: `${formatNumber(metrics.returnsCount)} ${plural(metrics.returnsCount, ["возврат", "возврата", "возвратов"])}`,
          },
        ]
      : []),
    {
      key: "net_profit",
      label: "Чистая прибыль",
      icon: "wallet" as const,
      value: formatMoney(metrics.netProfit, currency),
      hint: metrics.returnsCount > 0 ? "с учётом возвратов" : undefined,
    },
    {
      key: "count",
      label: niche === "education" ? "Продажи курса" : "Количество продаж",
      icon: "sales" as const,
      value: formatNumber(metrics.sales),
    },
    {
      key: "average",
      label: "Средний чек",
      icon: "chart" as const,
      value: formatMoneyOrDash(metrics.averageCheck, currency),
    },
    {
      key: "conversion",
      label: "Конверсия",
      icon: "funnel" as const,
      value: formatPercent(metrics.conversion),
      hint: "из лида в продажу",
    },
  ];

  const columns: Column<Tables<"sales">>[] = [
    {
      key: "product",
      header: "Продукт",
      render: (sale) => (
        <span className="font-medium text-ink">{sale.product ?? "Без названия"}</span>
      ),
    },
    {
      key: "seller",
      header: niche === "education" ? "Продажник" : "Менеджер",
      hideOnMobile: true,
      render: (sale) => (
        <span className="text-muted">
          {sale.seller_id ? (memberNames.get(sale.seller_id) ?? "Сотрудник") : "—"}
        </span>
      ),
    },
    {
      key: "created",
      header: "Дата",
      hideOnMobile: true,
      render: (sale) => (
        <span className="tabular text-muted">{formatDate(sale.created_at)}</span>
      ),
    },
    {
      key: "receipt",
      header: "Чек",
      hideOnMobile: true,
      render: (sale) =>
        sale.receipt_status === "confirmed" ? (
          <Badge tone="positive">Подтверждён</Badge>
        ) : (
          <Badge tone="warning">Ожидается</Badge>
        ),
    },
    {
      key: "amount",
      header: "Сумма",
      align: "right",
      render: (sale) => (
        <span className="tabular font-semibold text-ink">
          {formatMoney(Number(sale.amount), currency)}
        </span>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("sales")}
        title="Продажи"
        subtitle={`Сделки и деньги · ${formatDateRange(range.from, range.to)}`}
        actions={
          <DateRangePicker
            preset={range.preset}
            from={range.from}
            to={range.to}
            label={range.label}
          />
        }
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
          rows={sales}
          rowKey={(sale) => sale.id}
          empty={{
            icon: "sales",
            title: "За период продаж нет",
            text: "Карточки выше считаются из metrics_daily, а список — из таблицы продаж. Продажи появятся, когда сделки начнут закрываться.",
          }}
        />
      </div>
    </main>
  );
}
