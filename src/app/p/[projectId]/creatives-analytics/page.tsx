import { DateRangePicker } from "@/components/date-range-picker";
import { GroupLabel, PageHeader } from "@/components/layout/page-header";
import { StatStrip } from "@/components/metrics/stat-strip";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { compareByValue } from "@/lib/ads/attribution";
import { requireSectionAccess } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import {
  formatDateRange,
  formatMoney,
  formatMoneyOrDash,
  formatNumber,
  formatPercent,
  formatRatio,
  plural,
} from "@/lib/format";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadCreativesAnalytics, type CreativeRow } from "@/lib/queries/creatives";

/** Аналитика креативов: связка креатив → лид → продажа (ТЗ, Блок 3). */
export default async function CreativesAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  const [{ project }, data] = await Promise.all([
    requireSectionAccess(projectId, "creatives-analytics"),
    loadCreativesAnalytics(projectId, range),
  ]);

  const currency = project.currency;
  const { totals, attributedLeads, totalLeads } = data;

  // Пустые креативы прячем: в кабинете их сотни, а смотреть надо на работавшие.
  const rows = data.rows
    .filter((row) => row.spend > 0 || row.leads > 0 || row.sales > 0)
    .sort(compareByValue);

  const coverage = totalLeads > 0 ? attributedLeads / totalLeads : null;

  const stats = [
    {
      key: "spend",
      label: "Расход на креативы",
      value: formatMoney(totals.spend, currency),
      hint: formatDateRange(range.from, range.to),
    },
    {
      key: "revenue",
      label: "Выручка с них",
      value: formatMoney(totals.revenue, currency),
      accent: true,
      hint: `${formatNumber(totals.sales)} ${plural(totals.sales, ["продажа", "продажи", "продаж"])}`,
    },
    {
      key: "roas",
      label: "ROAS",
      value: formatRatio(totals.roas),
      hint: `прибыль ${formatMoney(totals.profit, currency)}`,
    },
    {
      key: "coverage",
      label: "Лидов с креативом",
      value: formatPercent(coverage),
      hint: `${formatNumber(attributedLeads)} из ${formatNumber(totalLeads)} за период`,
    },
  ];

  const columns: Column<CreativeRow>[] = [
    {
      key: "name",
      header: "Креатив",
      render: (row) => (
        <div>
          <span className="flex items-center gap-2 font-medium text-ink">
            {row.previewUrl ? (
              <a
                href={row.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="transition hover:text-brand-700"
              >
                {row.name}
              </a>
            ) : (
              row.name
            )}
            {row.status === "ACTIVE" ? <Badge tone="positive">активен</Badge> : null}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-faint">
            {row.campaignName ?? "Без кампании"}
          </span>
        </div>
      ),
    },
    {
      key: "leads",
      header: "Лиды",
      align: "right",
      render: (row) => (
        <div className="tabular">
          <span className="text-ink">{formatNumber(row.leads)}</span>
          {row.platformLeads > 0 ? (
            <span className="mt-0.5 block text-[11.5px] text-faint">
              в кабинете {formatNumber(row.platformLeads)}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "quality",
      header: "Качество",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <div className="tabular">
          <span className="text-ink">{formatPercent(row.qualityRate)}</span>
          <span className="mt-0.5 block text-[11.5px] text-faint">
            {formatNumber(row.qualified)} квалиф.
          </span>
        </div>
      ),
    },
    {
      key: "cpl",
      header: "Цена лида",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular text-muted">
          {formatMoneyOrDash(row.costPerLead, currency)}
        </span>
      ),
    },
    {
      key: "sales",
      header: "Продажи",
      align: "right",
      render: (row) => (
        <div className="tabular">
          <span className="text-ink">{formatNumber(row.sales)}</span>
          <span className="mt-0.5 block text-[11.5px] text-faint">
            {formatPercent(row.conversion)}
          </span>
        </div>
      ),
    },
    {
      key: "roas",
      header: "ROAS",
      align: "right",
      render: (row) => (
        <div className="tabular">
          <span
            className={
              row.roas !== null && row.roas >= 1
                ? "font-semibold text-brand-700"
                : row.spend > 0
                  ? "font-semibold text-negative"
                  : "text-muted"
            }
          >
            {formatRatio(row.roas)}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-faint">
            расход {formatMoney(row.spend, currency)}
          </span>
        </div>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("creatives-analytics")}
        title="Аналитика креативов"
        subtitle={`Креатив → лид → продажа · ${formatDateRange(range.from, range.to)}`}
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

      {totalLeads > 0 && attributedLeads < totalLeads ? (
        <section className="card mt-4 flex items-start gap-4 p-5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-amber-50 text-amber-700">
            <Icon name="funnel" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-ink">
              {formatNumber(totalLeads - attributedLeads)}{" "}
              {plural(totalLeads - attributedLeads, ["лид", "лида", "лидов"])} без креатива
            </h2>
            <p className="mt-1 max-w-[760px] text-[13px] leading-relaxed text-muted">
              Эти заявки в таблице не участвуют: неизвестно, какое объявление их привело.
              Привязка появляется, когда лид приходит с меткой креатива — с лид-формы, с
              сайта или из чат-бота. Пока метки нет, считайте цифры ниже нижней границей.
            </p>
          </div>
        </section>
      ) : null}

      <GroupLabel>Креативы</GroupLabel>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        empty={{
          icon: "creative",
          title: "Данных по креативам нет",
          text: "Синхронизируйте Meta Ads в разделе «Реклама»: оттуда придут объявления, расход и клики. Лиды и продажи подтянутся из CRM по метке креатива.",
        }}
      />

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-faint">
        «Лиды» — это заявки CRM, привязанные к креативу; «в кабинете» — то, что насчитала
        сама Meta. Расхождение нормально: кабинет считает нажатия на форму, а CRM — тех, кто
        реально дошёл. ROAS считается от выручки и расхода именно этого креатива.
      </p>
    </main>
  );
}
