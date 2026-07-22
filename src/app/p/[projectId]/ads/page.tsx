import Link from "next/link";

import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Icon } from "@/components/ui/icon";
import { setAdSpendRate } from "@/lib/actions/ads";
import { requireSectionAccess } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { readDateRange } from "@/lib/date-range";
import {
  currencySymbol,
  formatAdMoney,
  formatDate,
  formatDateRange,
  formatMoney,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadAdsData, type AdRow, type AdsLevel } from "@/lib/queries/ads";
import { loadIntegrations } from "@/lib/queries/integrations";

import { AutoSync } from "./auto-sync";

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

/** Куда ведёт группа объявлений. */
const DESTINATION_LABELS: Record<string, string> = {
  WHATSAPP: "WhatsApp",
  MESSENGER: "Messenger",
  INSTAGRAM_PROFILE: "Профиль Instagram",
  INSTAGRAM_DIRECT: "Instagram Direct",
  WEBSITE: "Сайт",
  ON_AD: "Форма в объявлении",
  PHONE_CALL: "Звонок",
};

const LEVELS: { key: AdsLevel; title: string }[] = [
  { key: "campaigns", title: "Кампании" },
  { key: "adsets", title: "Группы объявлений" },
  { key: "ads", title: "Объявления" },
];

/** Вкладки раздела. Запуск и подключения — следующий этап (ТЗ, Блок 3). */
const TABS = [
  { key: "analytics", title: "Аналитика", icon: "chart" as const },
  { key: "launch", title: "Запуск рекламы", icon: "send" as const },
  { key: "connections", title: "Подключения", icon: "plug" as const },
];

function isLevel(value: string | undefined): value is AdsLevel {
  return value === "campaigns" || value === "adsets" || value === "ads";
}

/** Реклама: кабинеты Meta и аналитика по ним (ТЗ, Блок 3). */
export default async function AdsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    range?: string;
    from?: string;
    to?: string;
    level?: string;
    tab?: string;
    all?: string;
  }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  const range = readDateRange(query);

  const level: AdsLevel = isLevel(query.level) ? query.level : "campaigns";
  const tab = TABS.some((item) => item.key === query.tab) ? (query.tab as string) : "analytics";
  const onlySpending = query.all !== "1";

  const [{ project, role, canManage }, integrations, ads] = await Promise.all([
    requireSectionAccess(projectId, "ads"),
    loadIntegrations(projectId),
    loadAdsData(projectId, range, level, { onlySpending }),
  ]);

  const currency = project.currency;
  const mayManage = canManage || role === "director";
  const connected = integrations.find((row) => row.provider === "meta")?.status === "connected";

  const { rows, totals, byPurpose, lastSyncedAt, hidden } = ads;
  const rate = Number(project.ad_spend_rate);
  const needsRate = Boolean(totals.sourceCurrency && totals.sourceCurrency !== currency);
  const adCurrency = totals.sourceCurrency ?? currency;

  /** Раздел говорит в валюте кабинета; тенге — подписью снизу. */
  const money = (source: number) => formatAdMoney(needsRate ? source : source, adCurrency);
  const asProject = (source: number) =>
    needsRate ? `≈ ${formatMoney(source * rate, currency)}` : null;
  const pick = (data: { spend: number; spendSource: number }) =>
    needsRate ? data.spendSource : data.spend;

  const courses = byPurpose.courses;
  const vacancy = byPurpose.vacancy;

  function href(next: Partial<{ level: AdsLevel; tab: string; all: string }>): string {
    const params = new URLSearchParams();
    if (query.range) params.set("range", query.range);
    if (query.from) params.set("from", query.from);
    if (query.to) params.set("to", query.to);

    const nextLevel = next.level ?? level;
    const nextTab = next.tab ?? tab;
    const nextAll = next.all === undefined ? (onlySpending ? undefined : "1") : next.all;

    if (nextLevel !== "campaigns") params.set("level", nextLevel);
    if (nextTab !== "analytics") params.set("tab", nextTab);
    if (nextAll) params.set("all", nextAll);

    const suffix = params.toString();
    return suffix ? `/p/${projectId}/ads?${suffix}` : `/p/${projectId}/ads`;
  }

  const cards = [
    {
      key: "total",
      label: "Всего на рекламу",
      icon: "ads" as const,
      value: money(pick(totals)),
      note: asProject(pick(totals)),
    },
    {
      key: "courses",
      label: "На курс",
      icon: "trial" as const,
      value: money(pick(courses)),
      note: asProject(pick(courses)),
      accent: true,
    },
    {
      key: "vacancy",
      label: "На вакансии",
      icon: "people" as const,
      value: money(pick(vacancy)),
      note: asProject(pick(vacancy)),
      muted: true,
    },
    {
      key: "leads",
      label: `Лиды курса: ${formatNumber(courses.leads)} · цена`,
      icon: "leads" as const,
      value: courses.cpl === null ? "—" : formatAdMoney(courses.cpl, adCurrency),
      note: courses.cpl === null ? null : asProject(courses.cpl),
    },
  ];

  /** Метрики курса — без вакансий: их отклики к обучению отношения не имеют. */
  const chips = [
    { key: "cpl", label: "CPL · за лид", value: courses.cpl, money: true },
    { key: "cpm", label: "CPM · 1000 показов", value: courses.cpm, money: true },
    { key: "cpc", label: "CPC · за клик", value: courses.cpc, money: true },
    { key: "ctr", label: "CTR", value: courses.ctr, money: false },
    { key: "freq", label: "Частота", value: courses.frequency, money: false },
  ];

  const columns: Column<AdRow>[] = [
    {
      key: "name",
      header: LEVELS.find((item) => item.key === level)?.title ?? "Строка",
      render: (row) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate font-medium text-ink">{row.name}</span>
            {row.purpose === "vacancy" ? <Badge tone="info">Вакансия</Badge> : null}
          </div>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-faint">
            <span
              className={cn(
                "inline-flex items-center gap-1",
                row.status === "ACTIVE" ? "text-brand-700" : "text-faint",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  row.status === "ACTIVE" ? "bg-brand" : "bg-slate-300",
                )}
              />
              {row.status ? (STATUS_LABELS[row.status] ?? row.status) : "—"}
            </span>
            {row.objective ? <span>· {OBJECTIVE_LABELS[row.objective] ?? row.objective}</span> : null}
            {row.destination ? (
              <span>· {DESTINATION_LABELS[row.destination] ?? row.destination}</span>
            ) : null}
            {row.parentName ? <span className="truncate">· {row.parentName}</span> : null}
          </span>
        </div>
      ),
    },
    {
      key: "leads",
      header: "Лиды",
      align: "right",
      render: (row) => (
        <span className="tabular font-medium text-ink">{formatNumber(row.leads)}</span>
      ),
    },
    {
      key: "cpl",
      header: "Цена за лид",
      align: "right",
      render: (row) => (
        <span className="tabular text-muted">
          {row.cpl === null ? "—" : formatAdMoney(row.cpl, adCurrency)}
        </span>
      ),
    },
    {
      key: "spend",
      header: "Потрачено",
      align: "right",
      render: (row) => (
        <div className="tabular">
          <span className="font-semibold text-ink">{money(pick(row))}</span>
          {needsRate ? (
            <span className="mt-0.5 block text-[11px] font-normal text-faint">
              {asProject(pick(row))}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: "impressions",
      header: "Показы",
      align: "right",
      hideOnMobile: true,
      render: (row) => (
        <div className="tabular">
          <span className="text-ink">{formatNumber(row.impressions)}</span>
          <span className="mt-0.5 block text-[11px] text-faint">
            охват {formatNumber(row.reach)}
          </span>
        </div>
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
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("ads")}
        title="Реклама"
        subtitle={`Кабинеты Meta, запуск кампаний и аналитика — в ${adCurrency === "USD" ? "долларах $" : adCurrency}`}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {mayManage ? (
              <AutoSync
                projectId={projectId}
                lastSyncedAt={lastSyncedAt}
                enabled={connected}
              />
            ) : null}
            <DateRangePicker
              preset={range.preset}
              from={range.from}
              to={range.to}
              label={range.label}
            />
          </div>
        }
      />

      <nav className="mt-5 flex gap-1 border-b border-line" aria-label="Разделы рекламы">
        {TABS.map((item) => (
          <Link
            key={item.key}
            href={href({ tab: item.key })}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-[13px] transition",
              tab === item.key
                ? "border-brand text-brand-700"
                : "border-transparent text-muted hover:border-line hover:text-ink",
            )}
          >
            <Icon name={item.icon} className="h-4 w-4" />
            {item.title}
          </Link>
        ))}
      </nav>

      {tab !== "analytics" ? (
        <section className="card mt-6 flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-canvas text-muted">
            <Icon name={tab === "launch" ? "send" : "plug"} className="h-5 w-5" />
          </span>
          <h2 className="text-[15px] font-semibold text-ink">
            {tab === "launch" ? "Запуск рекламы" : "Подключения"}
          </h2>
          <p className="max-w-[520px] text-[13px] leading-relaxed text-muted">
            {tab === "launch"
              ? "Здесь будут настройки запуска: бюджет, география, возраст, аудитории — и креативы, которые бот отправляет в кабинет сам."
              : "Здесь будут рекламные кабинеты проекта: какой подключён, кем и когда."}{" "}
            Раздел ещё не сделан.
          </p>
        </section>
      ) : (
        <>
          {!connected ? (
            <section className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-amber-50 text-amber-700">
              <Icon name="plug" className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-ink">Meta Ads не подключена</h2>
                  <p className="mt-1 max-w-[620px] text-[13px] leading-relaxed text-muted">
                    Ниже — цифры с прошлой синхронизации. Добавьте access token и ID кабинета,
                    и платформа снова начнёт обновлять их сама: раз в час и при заходе сюда.
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
                  <p className="tabular mt-1.5 text-[11.5px] text-faint">{card.note}</p>
                ) : null}
              </article>
            ))}
          </section>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-muted">Метрики по курсу:</span>
            {chips.map((chip) => (
              <span
                key={chip.key}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] transition hover:border-brand-200"
              >
                <span className="text-faint">{chip.label}</span>
                <span className="tabular font-semibold text-ink">
                  {chip.value === null
                    ? "—"
                    : chip.money
                      ? formatAdMoney(chip.value, adCurrency)
                      : chip.key === "ctr"
                        ? formatPercent(chip.value, 2)
                        : formatNumber(chip.value, 2)}
                </span>
              </span>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-[12px] bg-canvas p-1">
              {LEVELS.map((item) => (
                <Link
                  key={item.key}
                  href={href({ level: item.key })}
                  className={cn(
                    "rounded-[9px] px-3.5 py-2 text-[13px] transition",
                    level === item.key
                      ? "bg-surface font-medium text-ink shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
                      : "text-muted hover:text-ink",
                  )}
                >
                  {item.title}
                </Link>
              ))}
            </div>

            <Link
              href={href({ all: onlySpending ? "1" : "" })}
              className="text-[12.5px] text-muted transition hover:text-brand-700"
            >
              {onlySpending
                ? `Показать все${hidden > 0 ? ` (+${formatNumber(hidden)} без расхода)` : ""}`
                : "Только с расходом"}
            </Link>
          </div>

          <p className="mt-2 px-1 text-[12px] text-faint">
            {formatNumber(rows.length)} · {formatDateRange(range.from, range.to)}
            {lastSyncedAt ? ` · обновлено ${formatDate(lastSyncedAt)}` : ""}
          </p>

          <div className="mt-2">
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              empty={{
                icon: "ads",
                title: "За период расхода не было",
                text: "Либо в этом периоде кампании не крутились, либо цифры ещё не приехали из Meta. Можно расширить период или показать все строки.",
              }}
            />
          </div>

          {needsRate ? (
            <section className="card mt-4 flex flex-wrap items-end justify-between gap-4 p-5">
              <div>
                <h2 className="text-[14px] font-semibold text-ink">
                  Кабинет в {totals.sourceCurrency}, проект считает в {currencySymbol(currency)}
                </h2>
                <p className="mt-1 max-w-[620px] text-[13px] leading-relaxed text-muted">
                  В этом разделе суммы показаны как в кабинете. Курс нужен, чтобы расход
                  попал в прибыль на Главной.
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

          <p className="mt-3 px-1 text-[12px] leading-relaxed text-faint">
            Лидом считаем заявку с формы или сайта плюс начатую переписку в WhatsApp и Direct:
            у кампаний на переписки поля «лид» нет вообще. Карточки «На курс» и метрики ниже
            вакансии не учитывают — вакансия ищет сотрудника, а не ученика. В прибыль на
            Главной расход уходит целиком, включая вакансии: деньги потрачены.
          </p>
        </>
      )}
    </main>
  );
}
