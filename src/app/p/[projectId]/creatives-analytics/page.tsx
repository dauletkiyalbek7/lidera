import Link from "next/link";

import { DateRangePicker } from "@/components/date-range-picker";
import { GroupLabel, PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { requireSectionAccess } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { readDateRange } from "@/lib/date-range";
import { setCplLimit } from "@/lib/actions/ads";
import { STATUS_META, type CreativeStatus } from "@/lib/ads/creative-status";
import {
  formatAdMoney,
  formatDateRange,
  formatMoney,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadCreativesAnalytics, type CreativeRow } from "@/lib/queries/creatives";

/**
 * Аналитика креативов: связка креатив → лид → продажа (ТЗ, Блок 3).
 *
 * Только курсы: вакансии сюда не мешаем. Каждому объявлению — статус по цене
 * лида (топ / норма / слабый / выключить), чтобы сразу видеть, что масштабировать,
 * а что гасить. Суммы — в валюте кабинета, тенге подписью снизу.
 */

type StatusFilter = CreativeStatus | "all";

const STATUS_FILTERS: { key: StatusFilter; title: string }[] = [
  { key: "all", title: "Все" },
  { key: "off", title: STATUS_META.off.label },
  { key: "weak", title: STATUS_META.weak.label },
  { key: "ok", title: STATUS_META.ok.label },
  { key: "top", title: STATUS_META.top.label },
];

function readStatus(raw: string | undefined): StatusFilter {
  return raw && raw in STATUS_META ? (raw as CreativeStatus) : "all";
}

/**
 * Миниатюра объявления.
 *
 * Обычный <img>, а не next/image: ссылки ведут на CDN Meta, живут недолго и
 * меняются при каждой синхронизации — оптимизировать там нечего.
 */
function Thumb({ row, size }: { row: CreativeRow; size: "sm" | "lg" }) {
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
    status?: string;
    all?: string;
  }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const range = readDateRange(query);
  const statusFilter = readStatus(query.status);
  const onlyActive = query.all !== "1";

  const { project, role, canManage } = await requireSectionAccess(
    projectId,
    "creatives-analytics",
  );
  const cplLimit = Number(project.cpl_limit);
  const data = await loadCreativesAnalytics(projectId, range, { onlyActive, cplLimit });

  const currency = project.currency;
  const rate = Number(project.ad_spend_rate);
  const { rows, totals, sourceCurrency, hidden, statusCounts } = data;

  const mayManage = canManage || role === "director";
  const needsRate = Boolean(sourceCurrency && sourceCurrency !== currency);
  const adCurrency = sourceCurrency ?? currency;

  /** Раздел говорит в валюте кабинета; тенге — подписью снизу. */
  const money = (source: number) => formatAdMoney(source, adCurrency);
  const asProject = (source: number) =>
    needsRate ? `≈ ${formatMoney(source * rate, currency)}` : null;
  const pick = (row: { spend: number; spendSource: number }) =>
    needsRate ? row.spendSource : row.spend;

  const totalSpend = pick(totals);
  const platformCpl = totals.platformLeads > 0 ? totalSpend / totals.platformLeads : null;

  function href(next: Partial<{ status: StatusFilter; all: string | null }>): string {
    const params = new URLSearchParams();
    if (query.range) params.set("range", query.range);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);

    const nextStatus = next.status ?? statusFilter;
    if (nextStatus !== "all") params.set("status", nextStatus);

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
      key: "cpl",
      label: `Цена лида · ${formatNumber(totals.platformLeads)} лидов`,
      icon: "leads" as const,
      value: platformCpl === null ? "—" : formatAdMoney(platformCpl, adCurrency),
      note:
        platformCpl === null
          ? null
          : `лимит ${formatAdMoney(cplLimit, adCurrency)}`,
      accent: true,
    },
    {
      key: "off",
      label: "К выключению",
      icon: "shield" as const,
      value: formatNumber(statusCounts.off),
      note: statusCounts.off > 0 ? "дороже лимита или без лидов" : "таких нет — хорошо",
      danger: statusCounts.off > 0,
    },
    {
      key: "top",
      label: "Топ — можно масштабировать",
      icon: "sparkle" as const,
      value: formatNumber(statusCounts.top),
      note: statusCounts.top > 0 ? "дешёвый лид, есть объём" : "пока нет явных лидеров",
      muted: statusCounts.top === 0,
    },
  ];

  const filtered =
    statusFilter === "all" ? rows : rows.filter((row) => row.verdict === statusFilter);

  // Рекомендации: сначала то, что требует действия (выключить, затем слабые);
  // если таких нет — показываем лучших, которых стоит масштабировать.
  const needsAction = rows
    .filter((row) => row.verdict === "off" || row.verdict === "weak")
    .slice(0, 6);
  const highlights =
    needsAction.length > 0 ? needsAction : rows.filter((row) => row.verdict === "top").slice(0, 6);
  const highlightsTitle =
    needsAction.length > 0 ? "Требуют внимания" : "Лучшие — можно добавить бюджет";

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
            </span>
            <span className="mt-0.5 block truncate text-[11.5px] text-faint">
              {row.adSetName ?? row.campaignName ?? "Без кампании"}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Статус",
      render: (row) => (
        <Badge tone={STATUS_META[row.verdict].tone}>{STATUS_META[row.verdict].label}</Badge>
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
      render: (row) => (
        <span
          className={cn(
            "tabular",
            row.verdict === "off"
              ? "font-semibold text-negative"
              : row.verdict === "top"
                ? "font-semibold text-brand-700"
                : "text-muted",
          )}
        >
          {row.cplSource === null ? "—" : formatAdMoney(row.cplSource, adCurrency)}
        </span>
      ),
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
      key: "sales",
      header: "Продажи",
      align: "right",
      hideOnMobile: true,
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
        subtitle={`Только курсы · ${formatDateRange(range.from, range.to)}`}
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
              card.danger && "ring-1 ring-rose-100",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-[12.5px] text-muted">{card.label}</p>
              <span
                className={cn(
                  "inline-flex h-7 w-7 items-center justify-center rounded-[9px] transition group-hover:scale-110",
                  card.accent
                    ? "bg-brand-50 text-brand"
                    : card.danger
                      ? "bg-rose-50 text-rose-600"
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
                card.accent
                  ? "text-brand-700"
                  : card.danger
                    ? "text-negative"
                    : card.muted
                      ? "text-muted"
                      : "text-ink",
              )}
            >
              {card.value}
            </p>
            {card.note ? <p className="mt-1.5 text-[11.5px] text-faint">{card.note}</p> : null}
          </article>
        ))}
      </section>

      {mayManage ? (
        <form
          action={setCplLimit}
          className="card mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 p-4"
        >
          <input type="hidden" name="project_id" value={projectId} />
          <div className="flex items-center gap-2">
            <Icon name="sliders" className="h-4 w-4 text-muted" />
            <label htmlFor="cpl-limit" className="text-[13px] text-ink">
              Лимит цены лида
            </label>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              id="cpl-limit"
              name="limit"
              type="number"
              step="0.01"
              min="0.01"
              defaultValue={cplLimit}
              className="tabular w-24 rounded-[10px] border border-line bg-white px-3 py-1.5 text-[13px] text-ink outline-none focus:border-brand"
            />
            <span className="text-[13px] text-muted">{adCurrency === "USD" ? "$" : adCurrency}</span>
          </div>
          <button
            type="submit"
            className="rounded-[10px] bg-brand px-3.5 py-1.5 text-[13px] font-medium text-white transition hover:bg-brand-600"
          >
            Сохранить
          </button>
          <p className="text-[12px] text-faint">
            Дороже этого объявление помечается «выключить». Топ — дешевле половины лимита.
          </p>
        </form>
      ) : null}

      {highlights.length > 0 ? (
        <>
          <GroupLabel>{highlightsTitle}</GroupLabel>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {highlights.map((row) => {
              const meta = STATUS_META[row.verdict];
              return (
                <article
                  key={row.id}
                  className="card group overflow-hidden p-3 transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
                >
                  <div className="relative">
                    <Thumb row={row} size="lg" />
                    <span className="absolute left-2 top-2">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </span>
                  </div>

                  <div className="mt-3 px-1.5 pb-1">
                    {row.previewUrl ? (
                      <a
                        href={row.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-[13.5px] font-medium text-ink transition hover:text-brand-700"
                      >
                        {row.name}
                      </a>
                    ) : (
                      <span className="block truncate text-[13.5px] font-medium text-ink">
                        {row.name}
                      </span>
                    )}
                    <p className="mt-0.5 text-[11.5px] text-faint">{meta.advice}</p>

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
                        <dd
                          className={cn(
                            "tabular mt-0.5 text-[13px] font-medium",
                            row.verdict === "off" ? "text-negative" : "text-brand-700",
                          )}
                        >
                          {row.cplSource === null ? "—" : formatAdMoney(row.cplSource, adCurrency)}
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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-1 rounded-[12px] bg-canvas p-1" aria-label="Статус">
          {STATUS_FILTERS.map((tab) => {
            const count = tab.key === "all" ? rows.length : statusCounts[tab.key];
            return (
              <Link
                key={tab.key}
                href={href({ status: tab.key })}
                className={cn(
                  "rounded-[9px] px-3 py-1.5 text-[13px] transition",
                  statusFilter === tab.key
                    ? "bg-white text-ink shadow-[var(--shadow-card)]"
                    : "text-muted hover:text-ink",
                )}
              >
                {tab.title}
                <span className="ml-1.5 text-faint">{formatNumber(count)}</span>
              </Link>
            );
          })}
        </nav>

        {hidden > 0 ? (
          <Link
            href={href({ all: onlyActive ? "1" : null })}
            className="text-[12px] text-brand-700 transition hover:text-brand"
          >
            {onlyActive ? `показать все (+${formatNumber(hidden)})` : "только активные"}
          </Link>
        ) : null}
      </div>

      <GroupLabel>Все объявления курсов</GroupLabel>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey={(row) => row.id}
        empty={{
          icon: "creative",
          title: "За этот период объявления не работали",
          text: "Выберите другой диапазон дат или нажмите «показать все» — в кабинете много остановленных объявлений, и по умолчанию они скрыты.",
        }}
      />

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-faint">
        Статус считается по цене лида из кабинета: дороже лимита — «выключить», дешевле
        половины лимита с объёмом — «топ». «в CRM» — заявки, дошедшие до платформы; они
        появятся, когда подключите приём заявок. Суммы — в валюте кабинета.
      </p>
    </main>
  );
}
