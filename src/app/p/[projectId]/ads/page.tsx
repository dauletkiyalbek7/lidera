import Link from "next/link";

import { DateRangePicker } from "@/components/date-range-picker";
import { GroupLabel, PageHeader } from "@/components/layout/page-header";
import { StatStrip } from "@/components/metrics/stat-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { setAdSpendRate } from "@/lib/actions/ads";
import { requireSectionAccess } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import {
  currencySymbol,
  formatDate,
  formatDateRange,
  formatAdMoney,
  formatMoney,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadAdsData, type CampaignRow } from "@/lib/queries/ads";
import { loadIntegrations } from "@/lib/queries/integrations";

import { SyncPanel } from "./sync-panel";

/** Статусы Meta по-русски: в кабинете они приходят капсом на английском. */
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Активна",
  PAUSED: "На паузе",
  ARCHIVED: "В архиве",
  DELETED: "Удалена",
  CAMPAIGN_PAUSED: "Кампания на паузе",
  ADSET_PAUSED: "Группа на паузе",
  IN_PROCESS: "Запускается",
  WITH_ISSUES: "С ошибками",
};

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_LEADS: "Заявки",
  OUTCOME_SALES: "Продажи",
  OUTCOME_TRAFFIC: "Трафик",
  OUTCOME_ENGAGEMENT: "Вовлечение",
  OUTCOME_AWARENESS: "Узнаваемость",
  OUTCOME_APP_PROMOTION: "Приложение",
};

/** Реклама: кампании Meta Ads и их деньги (ТЗ, Блок 3). */
export default async function AdsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  const [{ project, role, canManage }, integrations, ads] = await Promise.all([
    requireSectionAccess(projectId, "ads"),
    loadIntegrations(projectId),
    loadAdsData(projectId, range, "meta"),
  ]);

  const currency = project.currency;
  const mayManage = canManage || role === "director";
  const meta = integrations.find((row) => row.provider === "meta");
  const connected = meta?.status === "connected";

  const { campaigns, totals, lastSyncedAt } = ads;
  const rate = Number(project.ad_spend_rate);
  const needsRate = Boolean(totals.sourceCurrency && totals.sourceCurrency !== currency);

  /**
   * Раздел «Реклама» говорит на языке рекламного кабинета: если он в долларах,
   * суммы показываем в долларах, а тенге подписываем снизу мелким.
   * В денежных разделах наоборот — там всё сводится к валюте проекта.
   */
  const adCurrency = totals.sourceCurrency ?? currency;
  const adSpend = needsRate ? totals.spendSource : totals.spend;
  const asProjectMoney = (source: number) =>
    `≈ ${formatMoney(needsRate ? source * rate : source, currency)}`;

  const costPerLead = totals.leads > 0 ? adSpend / totals.leads : null;
  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : null;

  const stats = [
    {
      key: "spend",
      label: "Расход за период",
      value: formatAdMoney(adSpend, adCurrency),
      accent: true,
      hint: needsRate
        ? `${asProjectMoney(totals.spendSource)} по курсу ${formatNumber(rate, 2)}`
        : formatDateRange(range.from, range.to),
    },
    {
      key: "leads",
      label: "Лиды из рекламы",
      value: formatNumber(totals.leads),
      hint: "заявки и начатые переписки",
    },
    {
      key: "cpl",
      label: "Цена лида",
      value: costPerLead === null ? "—" : formatAdMoney(costPerLead, adCurrency),
      hint: costPerLead === null || !needsRate ? undefined : asProjectMoney(costPerLead),
    },
    {
      key: "ctr",
      label: "CTR",
      value: formatPercent(ctr, 2),
      hint: `${formatNumber(totals.clicks)} кликов · ${formatNumber(totals.impressions)} показов`,
    },
  ];

  const columns: Column<CampaignRow>[] = [
    {
      key: "name",
      header: "Кампания",
      render: (row) => (
        <div>
          <span className="font-medium text-ink">{row.name}</span>
          <span className="mt-0.5 block text-[11.5px] text-faint">
            {row.objective ? (OBJECTIVE_LABELS[row.objective] ?? row.objective) : "Без цели"}
            {row.dailyBudget
              ? ` · бюджет ${formatNumber(row.dailyBudget, 2)} ${row.currency ?? ""} в день`
              : row.lifetimeBudget
                ? ` · бюджет ${formatNumber(row.lifetimeBudget, 2)} ${row.currency ?? ""} на весь срок`
                : ""}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Статус",
      hideOnMobile: true,
      render: (row) => (
        <Badge tone={row.status === "ACTIVE" ? "positive" : "muted"}>
          {row.status ? (STATUS_LABELS[row.status] ?? row.status) : "—"}
        </Badge>
      ),
    },
    {
      key: "leads",
      header: "Лиды",
      align: "right",
      render: (row) => (
        <span className="tabular text-ink">{formatNumber(row.leads)}</span>
      ),
    },
    {
      key: "cpl",
      header: "Цена лида",
      align: "right",
      hideOnMobile: true,
      render: (row) => {
        const source = needsRate ? row.spendSource : row.spend;
        return (
          <span className="tabular text-muted">
            {row.leads > 0 ? formatAdMoney(source / row.leads, adCurrency) : "—"}
          </span>
        );
      },
    },
    {
      key: "spend",
      header: "Расход",
      align: "right",
      render: (row) => {
        const source = needsRate ? row.spendSource : row.spend;
        return (
          <div className="tabular">
            <span className="font-semibold text-ink">{formatAdMoney(source, adCurrency)}</span>
            {needsRate ? (
              <span className="mt-0.5 block text-[11px] font-normal text-faint">
                {asProjectMoney(source)}
              </span>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("ads")}
        title="Реклама"
        subtitle={
          lastSyncedAt
            ? `Meta Ads · последняя синхронизация ${formatDate(lastSyncedAt)} · ${formatDateRange(range.from, range.to)}`
            : `Meta Ads · ${formatDateRange(range.from, range.to)}`
        }
        actions={
          <>
            <DateRangePicker
              preset={range.preset}
              from={range.from}
              to={range.to}
              label={range.label}
            />
            {mayManage ? <SyncPanel projectId={projectId} connected={connected} /> : null}
          </>
        }
      />

      {!connected ? (
        <section className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-amber-50 text-amber-700">
              <Icon name="plug" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-ink">Meta Ads не подключена</h2>
              <p className="mt-1 max-w-[620px] text-[13px] leading-relaxed text-muted">
                Добавьте access token и ID рекламного кабинета — после этого кампании,
                расход и лиды подтянутся сюда, а расход попадёт на Главную.
              </p>
            </div>
          </div>
          <Link
            href={`/p/${projectId}/integrations`}
            className="text-[13px] font-medium text-brand-700 transition hover:text-brand"
          >
            Перейти в «Интеграции» →
          </Link>
        </section>
      ) : null}

      <div className="mt-6">
        <StatStrip stats={stats} />
      </div>

      {needsRate ? (
        <section className="card mt-4 flex flex-wrap items-end justify-between gap-4 p-5">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">
              Кабинет ведётся в {totals.sourceCurrency}, проект считает в{" "}
              {currencySymbol(currency)}
            </h2>
            <p className="mt-1 max-w-[620px] text-[13px] leading-relaxed text-muted">
              Расход пересчитывается по этому курсу при синхронизации. Уже сохранённые дни
              пересчитаются, когда синхронизируете их снова.
            </p>
          </div>

          {mayManage ? (
            <form action={setAdSpendRate} className="flex items-end gap-2">
              <input type="hidden" name="project_id" value={projectId} />
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] text-muted">
                  1 {totals.sourceCurrency} = сколько {currencySymbol(currency)}
                </span>
                <input
                  name="rate"
                  type="number"
                  min={0.0001}
                  step={0.01}
                  defaultValue={rate}
                  className="h-11 w-[160px] rounded-[12px] border border-line bg-canvas px-3.5 text-sm text-ink transition focus:border-brand-200 focus:bg-surface focus:outline-none"
                />
              </label>
              <Button type="submit" variant="secondary">
                Сохранить курс
              </Button>
            </form>
          ) : null}
        </section>
      ) : null}

      <GroupLabel>Кампании</GroupLabel>

      <DataTable
        columns={columns}
        rows={campaigns}
        rowKey={(row) => row.id}
        empty={{
          icon: "ads",
          title: connected ? "Кампании ещё не загружены" : "Данных рекламы нет",
          text: connected
            ? "Нажмите «Синхронизировать» — платформа заберёт кампании и статистику за последние 30 дней."
            : "Подключите Meta Ads в «Интеграциях», и кампании появятся здесь.",
        }}
      />

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-faint">
        Лидом считаем заявку с формы или сайта плюс начатую переписку в WhatsApp и Direct:
        у кампаний на переписки поля «лид» нет вообще, и без этого половина заявок терялась бы.
        Расход по дням уходит в metrics_daily и виден на Главной. Лиды рекламного кабинета
        туда не пишутся — там живут лиды CRM, и смешивать их нельзя.
      </p>
    </main>
  );
}
