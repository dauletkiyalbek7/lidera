import Link from "next/link";

import { DateRangePicker } from "@/components/date-range-picker";
import { GroupLabel, PageHeader } from "@/components/layout/page-header";
import { MetricCard } from "@/components/metrics/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSection } from "@/components/ui/card-section";
import { DataTable, type Column } from "@/components/ui/data-table";
import { deleteFunnel, saveFunnel } from "@/lib/actions/marketing";
import { requireSectionAccess } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { readDateRange } from "@/lib/date-range";
import { LEAD_SOURCE_LABELS } from "@/lib/domain";
import {
  formatDateRange,
  formatMoney,
  formatMoneyOrDash,
  formatNumber,
  formatPercent,
  formatRatio,
} from "@/lib/format";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadMarketingData, type SourceRow } from "@/lib/queries/marketing";

const FIELD_CLASS =
  "h-10 rounded-[11px] border border-line bg-canvas px-3 text-[13px] text-ink " +
  "transition focus:border-brand-200 focus:bg-surface focus:outline-none";

/** Marketing Dashboard: деньги, лиды, продажи и сохранённые воронки (ТЗ, Блок 3). */
export default async function MarketingDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    source?: string;
    creative?: string;
  }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const range = readDateRange(query);

  const source = query.source && query.source in LEAD_SOURCE_LABELS ? query.source : null;
  const creativeId = query.creative || null;

  const [{ project, role, canManage }, data] = await Promise.all([
    requireSectionAccess(projectId, "marketing-dashboard"),
    loadMarketingData(projectId, range, { source, creativeId }),
  ]);

  const currency = project.currency;
  const mayManage = canManage || role === "director";
  const activeCreative = data.creatives.find((item) => item.id === creativeId);

  /** Ссылка фильтра сохраняет период: иначе клик сбросит выбранные даты. */
  function filterHref(next: { source?: string | null; creative?: string | null }): string {
    const params = new URLSearchParams();
    if (query.range) params.set("range", query.range);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);

    const nextSource = next.source === undefined ? source : next.source;
    const nextCreative = next.creative === undefined ? creativeId : next.creative;
    if (nextSource) params.set("source", nextSource);
    if (nextCreative) params.set("creative", nextCreative);

    const suffix = params.toString();
    return suffix
      ? `/p/${projectId}/marketing-dashboard?${suffix}`
      : `/p/${projectId}/marketing-dashboard`;
  }

  const cards = [
    {
      key: "spend",
      label: "Расход",
      icon: "ads" as const,
      value: data.spend === null ? "—" : formatMoney(data.spend, currency),
      hint: data.spendNote,
    },
    {
      key: "leads",
      label: "Лиды",
      icon: "leads" as const,
      value: formatNumber(data.leads),
      hint: `${formatNumber(data.qualified)} квалифицировано`,
    },
    {
      key: "cpl",
      label: "Цена лида",
      icon: "funnel" as const,
      value: formatMoneyOrDash(data.costPerLead, currency),
    },
    {
      key: "sales",
      label: "Продажи",
      icon: "sales" as const,
      value: formatNumber(data.sales),
      hint: `конверсия ${formatPercent(data.conversion)}`,
    },
    {
      key: "revenue",
      label: "Выручка",
      icon: "money" as const,
      value: formatMoney(data.revenue, currency),
      accent: true,
      hint: `средний чек ${formatMoneyOrDash(data.averageCheck, currency)}`,
    },
    {
      key: "roas",
      label: "ROAS",
      icon: "chart" as const,
      value: formatRatio(data.roas),
      hint: data.spend === null ? "нужен расход по срезу" : undefined,
    },
  ];

  const sourceColumns: Column<SourceRow>[] = [
    {
      key: "source",
      header: "Источник",
      render: (row) => (
        <Link
          href={filterHref({ source: source === row.key ? null : row.key })}
          className={cn(
            "font-medium transition hover:text-brand-700",
            source === row.key ? "text-brand-700" : "text-ink",
          )}
        >
          {row.label}
        </Link>
      ),
    },
    {
      key: "leads",
      header: "Лиды",
      align: "right",
      render: (row) => <span className="tabular text-ink">{formatNumber(row.leads)}</span>,
    },
    {
      key: "qualified",
      header: "Квалифицировано",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular text-muted">{formatNumber(row.qualified)}</span>
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
      key: "revenue",
      header: "Выручка",
      align: "right",
      render: (row) => (
        <span className="tabular font-semibold text-ink">
          {formatMoney(row.revenue, currency)}
        </span>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("marketing-dashboard")}
        title="Marketing Dashboard"
        subtitle={`Деньги, лиды и продажи маркетинга · ${formatDateRange(range.from, range.to)}`}
        actions={
          <DateRangePicker
            preset={range.preset}
            from={range.from}
            to={range.to}
            label={range.label}
          />
        }
      />

      {source || creativeId ? (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-faint">Срез:</span>
          {source ? (
            <Link href={filterHref({ source: null })}>
              <Badge tone="brand">Источник: {LEAD_SOURCE_LABELS[source]} ✕</Badge>
            </Link>
          ) : null}
          {activeCreative ? (
            <Link href={filterHref({ creative: null })}>
              <Badge tone="brand">Креатив: {activeCreative.name} ✕</Badge>
            </Link>
          ) : null}
          <Link
            href={filterHref({ source: null, creative: null })}
            className="text-[12px] text-muted transition hover:text-brand-700"
          >
            сбросить всё
          </Link>
        </div>
      ) : null}

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

      <GroupLabel>По источникам</GroupLabel>

      <DataTable
        columns={sourceColumns}
        rows={data.bySource}
        rowKey={(row) => row.key}
        empty={{
          icon: "funnel",
          title: "За период лидов нет",
          text: "Как только заявки начнут приходить, здесь появится разбивка по источникам: Meta, TikTok, WhatsApp и остальные.",
        }}
      />

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-faint">
        Реклама не делит расход по источникам, поэтому цена лида и ROAS в срезе по источнику
        не считаются. По креативу расход известен — там цифры полные.
      </p>

      <GroupLabel>Топ креативов</GroupLabel>

      <div className="grid gap-4 lg:grid-cols-2">
        <CardSection
          title="Что приносит выручку"
          hint="Клик по названию отфильтрует весь экран"
          icon="creative"
          bodyClassName="p-0"
        >
          {data.topCreatives.length === 0 ? (
            <p className="px-5 py-8 text-center text-[12.5px] text-faint">
              Ни один лид периода не привязан к креативу.
            </p>
          ) : (
            <ul className="flex flex-col">
              {data.topCreatives.map((creative) => (
                <li
                  key={creative.id}
                  className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={filterHref({ creative: creative.id })}
                      className="block truncate text-[13px] font-medium text-ink transition hover:text-brand-700"
                    >
                      {creative.name}
                    </Link>
                    <span className="mt-0.5 block text-[11.5px] text-faint">
                      {formatNumber(creative.leads)} лидов · {formatNumber(creative.sales)} продаж
                      {creative.spend > 0
                        ? ` · расход ${formatMoney(creative.spend, currency)}`
                        : ""}
                    </span>
                  </div>
                  <span className="tabular shrink-0 text-[13px] font-semibold text-ink">
                    {formatMoney(creative.revenue, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardSection>

        <CardSection
          title="Сохранённые воронки"
          hint="Именованный срез: источник, креатив и период"
          icon="funnel"
        >
          {data.funnels.length === 0 ? (
            <p className="rounded-[12px] bg-canvas px-4 py-6 text-center text-[12.5px] text-faint">
              Пока ни одной. Настройте срез выше и сохраните его — вернётесь одним кликом.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.funnels.map((funnel) => {
                const params = new URLSearchParams();
                if (funnel.range_preset) params.set("range", funnel.range_preset);
                if (funnel.source) params.set("source", funnel.source);
                if (funnel.creative_id) params.set("creative", funnel.creative_id);

                return (
                  <li key={funnel.id} className="flex items-center gap-2">
                    <Link
                      href={`/p/${projectId}/marketing-dashboard?${params.toString()}`}
                      className="flex-1 truncate rounded-[10px] bg-canvas px-3 py-2 text-[13px] text-ink transition hover:bg-brand-50 hover:text-brand-700"
                    >
                      {funnel.name}
                    </Link>
                    {mayManage ? (
                      <form action={deleteFunnel}>
                        <input type="hidden" name="project_id" value={projectId} />
                        <input type="hidden" name="funnel_id" value={funnel.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Удалить
                        </Button>
                      </form>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}

          {mayManage ? (
            <form action={saveFunnel} className="mt-4 flex gap-2 border-t border-line pt-4">
              <input type="hidden" name="project_id" value={projectId} />
              <input type="hidden" name="source" value={source ?? ""} />
              <input type="hidden" name="creative_id" value={creativeId ?? ""} />
              <input type="hidden" name="range" value={range.preset} />
              <input
                name="name"
                required
                minLength={2}
                maxLength={60}
                placeholder="Название текущего среза"
                className={cn(FIELD_CLASS, "flex-1")}
              />
              <Button type="submit" variant="secondary" size="sm">
                Сохранить
              </Button>
            </form>
          ) : null}
        </CardSection>
      </div>
    </main>
  );
}
