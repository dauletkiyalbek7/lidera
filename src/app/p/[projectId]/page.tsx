import { redirect } from "next/navigation";

import { DateRangePicker } from "@/components/date-range-picker";
import { GroupLabel, PageHeader } from "@/components/layout/page-header";
import { sectionBlockTitle } from "@/lib/navigation";
import { DailyDigest } from "@/components/metrics/daily-digest";
import { Funnel, type FunnelStage } from "@/components/metrics/funnel";
import { MetricCard } from "@/components/metrics/metric-card";
import { TopList, type TopEntry } from "@/components/metrics/top-list";
import { TrendChart } from "@/components/metrics/trend-chart";
import type { IconName } from "@/components/ui/icon";
import { firstAvailableSectionHref, requireProjectContext } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import { FUNNEL_STAGES, NICHE_LABELS, type Niche } from "@/lib/domain";
import { getSectionByKey, isSectionVisible } from "@/lib/navigation";
import {
  formatDateRange,
  formatMoney,
  formatMoneyOrDash,
  formatNumber,
  formatPercent,
  formatRatio,
  plural,
} from "@/lib/format";
import { changeRatio, deltaTone, type MetricsWithReturns } from "@/lib/metrics";
import { StatStrip } from "@/components/metrics/stat-strip";
import { summarizeInventory } from "@/lib/inventory";

import {
  loadDashboardData,
  type ManagerStat,
  type SalespersonStat,
} from "./dashboard-data";
import { DemoDataPanel } from "./demo-data-panel";

type CardSpec = {
  key: string;
  label: string;
  icon: IconName;
  value: string;
  hint?: string;
  accent?: boolean;
  compare?: { current: number; previous: number; direction: "up-good" | "down-good" };
};

function buildCards(
  niche: Niche,
  current: MetricsWithReturns,
  previous: MetricsWithReturns | null,
  currency: string,
): CardSpec[] {
  const money = (value: number) => formatMoney(value, currency);

  const shared: CardSpec[] = [
    {
      key: "revenue",
      label: niche === "education" ? "Доход" : "Выручка",
      icon: "money",
      value: money(current.revenue),
      accent: true,
      compare: { current: current.revenue, previous: previous?.revenue ?? 0, direction: "up-good" },
    },
    // Возвраты показываем, только когда они были: пустая карточка на нуле — лишний шум.
    ...(current.returnsCount > 0
      ? [
          {
            key: "returns",
            label: "Возвраты",
            icon: "returns" as const,
            value: `−${money(current.returnsAmount)}`,
            hint: `${formatPercent(current.refundRate)} от дохода`,
            compare: {
              current: current.returnsAmount,
              previous: previous?.returnsAmount ?? 0,
              direction: "down-good" as const,
            },
          },
        ]
      : []),
    {
      key: "ad_spend",
      label: "Расходы на рекламу",
      icon: "ads",
      value: money(current.adSpend),
      compare: { current: current.adSpend, previous: previous?.adSpend ?? 0, direction: "down-good" },
    },
    {
      key: "net_profit",
      label: niche === "education" ? "Чистая прибыль" : "Валовая прибыль",
      icon: "wallet",
      value: money(current.netProfit),
      hint: current.returnsCount > 0 ? "с учётом возвратов" : undefined,
      compare: {
        current: current.netProfit,
        previous: previous?.netProfit ?? 0,
        direction: "up-good",
      },
    },
    {
      key: "leads",
      label: "Лиды",
      icon: "leads",
      value: formatNumber(current.leads),
      compare: { current: current.leads, previous: previous?.leads ?? 0, direction: "up-good" },
    },
    {
      key: "cost_per_lead",
      label: "Цена лида",
      icon: "funnel",
      value: formatMoneyOrDash(current.costPerLead, currency),
      compare: {
        current: current.costPerLead ?? 0,
        previous: previous?.costPerLead ?? 0,
        direction: "down-good",
      },
    },
  ];

  if (niche === "education") {
    return [
      ...shared,
      {
        key: "trial_lessons",
        label: "Пробные уроки",
        icon: "trial",
        value: formatNumber(current.trialLessons),
        hint: `доходимость ${formatPercent(current.trialRate)}`,
        compare: {
          current: current.trialLessons,
          previous: previous?.trialLessons ?? 0,
          direction: "up-good",
        },
      },
      {
        key: "sales",
        label: "Продажи курса",
        icon: "sales",
        value: formatNumber(current.sales),
        hint: `средний чек ${formatMoneyOrDash(current.averageCheck, currency)}`,
        compare: { current: current.sales, previous: previous?.sales ?? 0, direction: "up-good" },
      },
      {
        key: "conversion",
        label: "Конверсия",
        icon: "chart",
        value: formatPercent(current.conversion),
        hint: "из лида в продажу",
        compare: {
          current: current.conversion ?? 0,
          previous: previous?.conversion ?? 0,
          direction: "up-good",
        },
      },
    ];
  }

  return [
    ...shared,
    {
      key: "sales",
      label: "Продажи",
      icon: "sales",
      value: formatNumber(current.sales),
      hint: `средний чек ${formatMoneyOrDash(current.averageCheck, currency)}`,
      compare: { current: current.sales, previous: previous?.sales ?? 0, direction: "up-good" },
    },
    {
      key: "conversion",
      label: "Конверсия",
      icon: "chart",
      value: formatPercent(current.conversion),
      hint: "из лида в продажу",
      compare: {
        current: current.conversion ?? 0,
        previous: previous?.conversion ?? 0,
        direction: "up-good",
      },
    },
    {
      key: "roas",
      label: "ROAS",
      icon: "creative",
      value: formatRatio(current.roas),
      hint: `ROI ${formatPercent(current.roi)}`,
      compare: { current: current.roas ?? 0, previous: previous?.roas ?? 0, direction: "up-good" },
    },
  ];
}

function buildFunnel(niche: Niche, metrics: MetricsWithReturns): FunnelStage[] {
  const values: Record<string, number> = {
    leads: metrics.leads,
    qualified: metrics.qualified,
    trial_lessons: metrics.trialLessons,
    sales: metrics.sales,
  };

  return FUNNEL_STAGES[niche].map((stage) => ({
    key: stage.key,
    label: stage.label,
    value: values[stage.key] ?? 0,
  }));
}

function managerEntries(stats: ManagerStat[]): TopEntry[] {
  return stats.map((stat) => ({
    id: stat.id,
    name: stat.name,
    primary: formatNumber(stat.trials),
    secondary: `${formatNumber(stat.leads)} ${plural(stat.leads, ["лид", "лида", "лидов"])} в работе`,
  }));
}

function salespersonEntries(stats: SalespersonStat[], currency: string): TopEntry[] {
  return stats.map((stat) => ({
    id: stat.id,
    name: stat.name,
    primary: formatMoney(stat.amount, currency),
    secondary: `${formatNumber(stat.count)} ${plural(stat.count, ["продажа", "продажи", "продаж"])}`,
  }));
}

/** Главная проекта (ТЗ, Блок 1). Все цифры — из metrics_daily за выбранный период. */
export default async function ProjectDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  // Контекст проекта и данные Главной не зависят друг от друга — грузим одной волной.
  const [context, data] = await Promise.all([
    requireProjectContext(projectId),
    loadDashboardData(projectId, range),
  ]);

  const { project, niche, canManage } = context;

  // Главную видят директор и владелец (ТЗ, раздел 7).
  // Остальных не упираем в «не найдено», а ведём в их первый доступный раздел.
  const dashboardSection = getSectionByKey("dashboard");
  if (dashboardSection && !isSectionVisible(dashboardSection, niche, context.role)) {
    redirect(await firstAvailableSectionHref(context, projectId));
  }

  const cards = buildCards(niche, data.current, data.previous, project.currency);

  const inventory = summarizeInventory(data.products);
  const warehouseStats = [
    { key: "sku", label: "Товаров в каталоге", value: formatNumber(inventory.skuCount) },
    { key: "units", label: "Единиц на складе", value: formatNumber(inventory.unitsInStock) },
    {
      key: "low",
      label: "Заканчиваются",
      value: formatNumber(inventory.lowStockCount),
      hint:
        inventory.outOfStockCount > 0
          ? `${formatNumber(inventory.outOfStockCount)} ${plural(inventory.outOfStockCount, ["позиция", "позиции", "позиций"])} не в наличии`
          : "дефицита нет",
    },
    {
      key: "cost",
      label: "Себестоимость склада",
      value: formatMoney(inventory.stockCost, project.currency),
      accent: true,
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("dashboard")}
        title="Главная"
        subtitle={`${NICHE_LABELS[niche]} · ${formatDateRange(range.from, range.to)}`}
        actions={
          <DateRangePicker
            preset={range.preset}
            from={range.from}
            to={range.to}
            label={range.label}
          />
        }
      />

      {!data.hasAnyMetrics ? (
        <div className="mt-6">
          <DemoDataPanel projectId={projectId} canManage={canManage} />
        </div>
      ) : null}

      <GroupLabel>Показатели за период</GroupLabel>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const change = card.compare
            ? changeRatio(card.compare.current, card.compare.previous)
            : undefined;
          return (
            <MetricCard
              key={card.key}
              label={card.label}
              value={card.value}
              hint={card.hint}
              icon={card.icon}
              accent={card.accent}
              change={data.previous ? change : undefined}
              tone={
                card.compare
                  ? deltaTone(change ?? null, card.compare.direction)
                  : "neutral"
              }
            />
          );
        })}
      </section>

      <GroupLabel>Динамика и воронка</GroupLabel>

      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <TrendChart
          points={data.rows.map((row) => ({
            date: row.date,
            revenue: Number(row.revenue),
            adSpend: Number(row.ad_spend),
          }))}
          currency={project.currency}
        />
        <Funnel stages={buildFunnel(niche, data.current)} />
      </section>

      {niche === "ecommerce" ? (
        <>
          <GroupLabel>Склад</GroupLabel>

          <section className="grid gap-4">
            <StatStrip stats={warehouseStats} />
            <DailyDigest
              today={data.today}
              products={data.products}
              currency={project.currency}
            />
          </section>
        </>
      ) : null}

      <GroupLabel>Команда</GroupLabel>

      {niche === "education" ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <TopList
            title="Топ менеджеров"
            hint="Квалификация лидов и запись на пробные уроки"
            icon="leads"
            entries={managerEntries(data.topManagers)}
            emptyText="Пока нет данных по менеджерам. Сотрудники появляются здесь после добавления в «Настройки → Сотрудники» и назначения на лиды."
          />
          <TopList
            title="Топ продажников"
            hint="Проведённые пробные и закрытые продажи курса"
            icon="trial"
            entries={salespersonEntries(data.topSalespeople, project.currency)}
            emptyText="Пока нет данных по продажникам. Здесь появятся те, кто закрывает продажи курса."
          />
        </section>
      ) : (
        <section>
          <TopList
            title="Топ менеджеров"
            hint="Обработка лидов и продажи товара"
            icon="leads"
            entries={salespersonEntries(data.topSalespeople, project.currency)}
            emptyText="Пока нет данных по менеджерам. Здесь появятся те, кто закрывает продажи."
          />
        </section>
      )}
    </main>
  );
}
