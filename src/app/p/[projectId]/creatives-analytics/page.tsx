import Link from "next/link";

import { DateRangePicker } from "@/components/date-range-picker";
import { GroupLabel, PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { requireSectionAccess } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { readDateRange } from "@/lib/date-range";
import { PURPOSE_LABELS, type CampaignPurpose } from "@/lib/ads/purpose";
import {
  formatAdMoney,
  formatDateRange,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRatio,
  plural,
} from "@/lib/format";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadCreativesAnalytics, type CreativeRow } from "@/lib/queries/creatives";

/**
 * Аналитика креативов: связка креатив → лид → продажа (ТЗ, Блок 3).
 *
 * Раздел отвечает на один вопрос: какое объявление стоит денег, а какое их
 * приносит. Поэтому суммы здесь — в валюте рекламного кабинета, как в разделе
 * «Реклама», а тенге идут подписью снизу.
 */

type PurposeFilter = CampaignPurpose | "all";

const PURPOSE_TABS: { key: PurposeFilter; title: string }[] = [
  { key: "all", title: "Все" },
  { key: "courses", title: PURPOSE_LABELS.courses },
  { key: "vacancy", title: PURPOSE_LABELS.vacancy },
];

function readPurpose(raw: string | undefined): PurposeFilter {
  return raw === "courses" || raw === "vacancy" ? raw : "all";
}

/**
 * Миниатюра объявления.
 *
 * Обычный <img>, а не next/image: ссылки ведут на CDN Meta, живут недолго и
 * меняются при каждой синхронизации — оптимизировать там нечего, а лишний
 * прокси только добавит точек отказа.
 */
function Thumb({
  row,
  size,
}: {
  row: CreativeRow;
  size: "sm" | "lg";
}) {
  const box = size === "lg" ? "h-[132px] w-full" : "h-11 w-11";

  return (
    <span
      className={cn(
        "relative block shrink-0 overflow-hidden rounded-[10px] bg-canvas",
        box,
      )}
    >
      {row.thumbnailUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={row.thumbnailUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-faint">
          <Icon name="creative" className={size === "lg" ? "h-6 w-6" : "h-4 w-4"} />
        </span>
      )}

      {row.mediaType === "video" ? (
        <span
          title="Видео"
          className="absolute bottom-1 right-1 inline-flex items-center justify-center rounded-full bg-black/60 p-1 text-white backdrop-blur-sm"
        >
          <Icon name="play" className={size === "lg" ? "h-3.5 w-3.5" : "h-2.5 w-2.5"} />
        </span>
      ) : null}
    </span>
  );
}

export default async function CreativesAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    purpose?: string;
    all?: string;
  }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const range = readDateRange(query);
  const purpose = readPurpose(query.purpose);
  const onlyActive = query.all !== "1";

  const [{ project }, data] = await Promise.all([
    requireSectionAccess(projectId, "creatives-analytics"),
    loadCreativesAnalytics(projectId, range, { purpose, onlyActive }),
  ]);

  const currency = project.currency;
  const rate = Number(project.ad_spend_rate);
  const { rows, totals, attributedLeads, totalLeads, sourceCurrency, hidden } = data;

  const needsRate = Boolean(sourceCurrency && sourceCurrency !== currency);
  const adCurrency = sourceCurrency ?? currency;

  /** Раздел говорит в валюте кабинета; тенге — подписью снизу. */
  const money = (source: number) => formatAdMoney(source, adCurrency);
  const asProject = (source: number) =>
    needsRate ? `≈ ${formatMoney(source * rate, currency)}` : null;
  const pick = (row: { spend: number; spendSource: number }) =>
    needsRate ? row.spendSource : row.spend;

  const totalSpend = pick(totals);
  /** Цена лида по данным кабинета: CRM-привязка появляется не сразу. */
  const platformCpl = totals.platformLeads > 0 ? totalSpend / totals.platformLeads : null;
  const coverage = totalLeads > 0 ? attributedLeads / totalLeads : null;

  function href(next: Partial<{ purpose: PurposeFilter; all: string | null }>): string {
    const params = new URLSearchParams();
    if (query.range) params.set("range", query.range);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);

    const nextPurpose = next.purpose ?? purpose;
    if (nextPurpose !== "all") params.set("purpose", nextPurpose);

    const nextAll = next.all === undefined ? (onlyActive ? null : "1") : next.all;
    if (nextAll) params.set("all", nextAll);

    const suffix = params.toString();
    const base = `/p/${projectId}/creatives-analytics`;
    return suffix ? `${base}?${suffix}` : base;
  }

  const cards = [
    {
      key: "spend",
      label: "Расход на креативы",
      icon: "ads" as const,
      value: money(totalSpend),
      note: asProject(totalSpend),
    },
    {
      key: "leads",
      label: `Лиды кабинета: ${formatNumber(totals.platformLeads)} · цена`,
      icon: "leads" as const,
      value: platformCpl === null ? "—" : formatAdMoney(platformCpl, adCurrency),
      note: platformCpl === null ? null : asProject(platformCpl),
      accent: true,
    },
    {
      key: "sales",
      label: `Продажи из CRM: ${formatNumber(totals.sales)} · выручка`,
      icon: "sales" as const,
      value: formatMoney(totals.revenue, currency),
      note: totals.sales > 0 ? `ROAS ${formatRatio(totals.roas)}` : "ждём первых продаж",
      muted: totals.sales === 0,
    },
    {
      key: "coverage",
      label: "Лидов с известным объявлением",
      icon: "funnel" as const,
      value: formatPercent(coverage),
      note: `${formatNumber(attributedLeads)} из ${formatNumber(totalLeads)} за период`,
      muted: !coverage,
    },
  ];

  /** Витрина: самые заметные объявления периода — их владелец узнаёт в лицо. */
  const featured = rows.slice(0, 6);

  const columns: Column<CreativeRow>[] = [
    {
      key: "name",
      header: "Креатив",
      render: (row) => (
        <div className="group flex items-center gap-3">
          <Thumb row={row} size="sm" />
          <div className="min-w-0">
            <span className="flex items-center gap-2">
              {row.previewUrl ? (
                <a
                  href={row.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-medium text-ink transition hover:text-brand-700"
                >
                  {row.name}
                </a>
              ) : (
                <span className="truncate font-medium text-ink">{row.name}</span>
              )}
              {row.status === "ACTIVE" ? <Badge tone="positive">активен</Badge> : null}
              {row.purpose === "vacancy" ? <Badge>вакансия</Badge> : null}
            </span>
            <span className="mt-0.5 block truncate text-[11.5px] text-faint">
              {row.adSetName ?? row.campaignName ?? "Без кампании"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "spend",
      header: "Потрачено",
      align: "right",
      render: (row) => (
        <div className="tabular">
          <span className="text-ink">{money(pick(row))}</span>
          {asProject(pick(row)) ? (
            <span className="mt-0.5 block text-[11px] text-faint">{asProject(pick(row))}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "leads",
      header: "Лиды",
      align: "right",
      render: (row) => (
        <div className="tabular">
          <span className="text-ink">{formatNumber(row.platformLeads)}</span>
          <span className="mt-0.5 block text-[11px] text-faint">
            {row.leads > 0 ? `в CRM ${formatNumber(row.leads)}` : "кабинет"}
          </span>
        </div>
      ),
    },
    {
      key: "cpl",
      header: "Цена лида",
      align: "right",
      render: (row) => {
        const cpl = row.platformLeads > 0 ? pick(row) / row.platformLeads : null;
        return (
          <span className="tabular text-muted">
            {cpl === null ? "—" : formatAdMoney(cpl, adCurrency)}
          </span>
        );
      },
    },
    {
      key: "clicks",
      header: "Клики",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <div className="tabular">
          <span className="text-ink">{formatNumber(row.clicks)}</span>
          <span className="mt-0.5 block text-[11px] text-faint">{formatPercent(row.ctr, 2)}</span>
        </div>
      ),
    },
    {
      key: "impressions",
      header: "Показы",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <span className="tabular text-muted">{formatNumber(row.impressions)}</span>
      ),
    },
    {
      key: "sales",
      header: "Продажи",
      align: "right",
      render: (row) => (
        <div className="tabular">
          <span className={row.sales > 0 ? "font-semibold text-brand-700" : "text-muted"}>
            {formatNumber(row.sales)}
          </span>
          <span className="mt-0.5 block text-[11px] text-faint">
            {row.sales > 0 ? formatMoney(row.revenue, currency) : "—"}
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

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article
            key={card.key}
            className={cn(
              "card group relative overflow-hidden p-5 transition duration-200",
              "hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]",
              card.accent && "ring-1 ring-brand-100",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[12.5px] text-muted">{card.label}</p>
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-[9px] transition group-hover:scale-110",
                  card.accent
                    ? "bg-brand-50 text-brand"
                    : card.muted
                      ? "bg-canvas text-faint"
                      : "bg-canvas text-muted",
                )}
              >
                <Icon name={card.icon} className="h-4 w-4" />
              </span>
            </div>
            <p
              className={cn(
                "tabular mt-2 text-[26px] font-semibold leading-none tracking-tight",
                card.accent ? "text-brand-700" : card.muted ? "text-muted" : "text-ink",
              )}
            >
              {card.value}
            </p>
            {card.note ? (
              <p className="mt-1.5 text-[11.5px] text-faint">{card.note}</p>
            ) : null}
          </article>
        ))}
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-[12px] bg-canvas p-1" aria-label="Назначение">
          {PURPOSE_TABS.map((tab) => (
            <Link
              key={tab.key}
              href={href({ purpose: tab.key })}
              className={cn(
                "rounded-[9px] px-3.5 py-1.5 text-[13px] transition",
                purpose === tab.key
                  ? "bg-white text-ink shadow-[var(--shadow-card)]"
                  : "text-muted hover:text-ink",
              )}
            >
              {tab.title}
            </Link>
          ))}
        </nav>

        <p className="text-[12px] text-faint">
          {formatNumber(rows.length)} {plural(rows.length, ["объявление", "объявления", "объявлений"])}
          {hidden > 0 ? (
            <>
              {" · "}
              <Link
                href={href({ all: onlyActive ? "1" : null })}
                className="text-brand-700 transition hover:text-brand"
              >
                {onlyActive ? `показать все (+${formatNumber(hidden)})` : "только активные"}
              </Link>
            </>
          ) : null}
        </p>
      </div>

      {featured.length > 0 ? (
        <>
          <GroupLabel>Заметнее всего за период</GroupLabel>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featured.map((row) => {
              const cpl = row.platformLeads > 0 ? pick(row) / row.platformLeads : null;
              return (
                <article
                  key={row.id}
                  className="card group overflow-hidden p-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
                >
                  <Thumb row={row} size="lg" />

                  <div className="mt-3 px-1.5 pb-1">
                    <div className="flex items-start justify-between gap-2">
                      {row.previewUrl ? (
                        <a
                          href={row.previewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-[13.5px] font-medium text-ink transition hover:text-brand-700"
                        >
                          {row.name}
                        </a>
                      ) : (
                        <span className="truncate text-[13.5px] font-medium text-ink">
                          {row.name}
                        </span>
                      )}
                      {row.purpose === "vacancy" ? <Badge>вакансия</Badge> : null}
                    </div>
                    <p className="mt-0.5 truncate text-[11.5px] text-faint">
                      {row.adSetName ?? row.campaignName ?? "Без кампании"}
                    </p>

                    <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                      <div>
                        <dt className="text-[11px] text-faint">Потрачено</dt>
                        <dd className="tabular mt-0.5 text-[13px] font-medium text-ink">
                          {money(pick(row))}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-faint">Лиды</dt>
                        <dd className="tabular mt-0.5 text-[13px] font-medium text-ink">
                          {formatNumber(row.platformLeads)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-faint">Цена лида</dt>
                        <dd className="tabular mt-0.5 text-[13px] font-medium text-brand-700">
                          {cpl === null ? "—" : formatAdMoney(cpl, adCurrency)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </article>
              );
            })}
          </section>
        </>
      ) : null}

      {totalLeads > 0 && attributedLeads < totalLeads ? (
        <section className="card mt-6 flex items-start gap-4 p-5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-amber-50 text-amber-700">
            <Icon name="funnel" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-ink">
              {formatNumber(totalLeads - attributedLeads)}{" "}
              {plural(totalLeads - attributedLeads, ["лид", "лида", "лидов"])} без объявления
            </h2>
            <p className="mt-1 max-w-[760px] text-[13px] leading-relaxed text-muted">
              У этих заявок неизвестно, какая реклама их привела, поэтому в колонке «в CRM»
              они не участвуют. Из WhatsApp объявление приходит само — Meta прикладывает его
              к первому сообщению. С сайта нужна метка: впишите в кабинете в «Параметры URL»
              строку <code className="rounded bg-canvas px-1">utm_content=&#123;&#123;ad.id&#125;&#125;</code>.
            </p>
          </div>
        </section>
      ) : null}

      <GroupLabel>Все объявления</GroupLabel>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(row) => row.id}
        empty={{
          icon: "creative",
          title: "За этот период объявления не работали",
          text: "Выберите другой диапазон дат или нажмите «показать все» — в кабинете много остановленных объявлений, и по умолчанию они скрыты.",
        }}
      />

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-faint">
        «Лиды» — то, что насчитала Meta: заявки с форм и начатые переписки. «в CRM» — те, кто
        реально дошёл до платформы; расхождение нормально и показывает потери. Цена лида
        считается от расхода именно этого объявления, суммы — в валюте кабинета.
      </p>
    </main>
  );
}
