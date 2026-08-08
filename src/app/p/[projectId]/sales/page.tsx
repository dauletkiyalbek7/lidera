import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { sectionBlockTitle } from "@/lib/navigation";
import { MetricCard } from "@/components/metrics/metric-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
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

/** Подпись статуса отправки события покупки в рекламный кабинет (CAPI). */
const CAPI_LABEL: Record<string, string> = {
  sent: "✓ ушло в Meta",
  failed: "⚠ Meta: ошибка",
  skipped: "Meta не настроена",
};

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
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-brand-50 text-brand-700">
            <Icon name="sales" className="h-4 w-4" />
          </span>
          <span className="truncate font-medium text-ink">{sale.product ?? "Без названия"}</span>
        </div>
      ),
    },
    {
      key: "seller",
      header: niche === "education" ? "Продажник" : "Менеджер",
      hideOnMobile: true,
      render: (sale) => {
        const name = sale.seller_id ? (memberNames.get(sale.seller_id) ?? "Сотрудник") : null;
        if (!name) return <span className="text-faint">—</span>;
        return (
          <div className="flex items-center gap-2.5">
            <Avatar name={name} size="sm" />
            <span className="truncate text-muted">{name}</span>
          </div>
        );
      },
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
      render: (sale) => (
        <div className="flex flex-col gap-1">
          {sale.receipt_status === "confirmed" ? (
            <Badge tone="positive">Подтверждён</Badge>
          ) : (
            <Badge tone="warning">Ожидается</Badge>
          )}
          {sale.receipt_status === "confirmed" ? (
            <span className="text-[11px] text-faint" title="Событие покупки в рекламный кабинет">
              {CAPI_LABEL[sale.capi_status] ?? null}
            </span>
          ) : null}
        </div>
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
