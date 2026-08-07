"use client";

import { useState } from "react";

import { fetchCreativeInsight } from "@/lib/actions/ads";
import type { CreativeInsight } from "@/lib/ads/creative-insight";
import { STATUS_META } from "@/lib/ads/creative-status";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import {
  formatAdMoney,
  formatMoney,
  formatNumber,
  formatPercent,
  formatRatio,
} from "@/lib/format";
import type { CreativeRow } from "@/lib/queries/creatives";

/**
 * Панель деталей креатива: выезжает поверх страницы (не уводит с раздела).
 * Метрики делим на кабинетные (в валюте кабинета) и результат CRM (в валюте
 * проекта), плюс ROMI. Видео и удержание тянем из Meta по запросу при открытии.
 */

type Money = { adCurrency: string; currency: string; needsRate: boolean; rate: number };

function Metric({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent?: "brand" | "negative";
  sub?: string | null;
}) {
  return (
    <div className="rounded-[10px] bg-canvas px-3 py-2.5">
      <dt className="text-[11px] text-faint">{label}</dt>
      <dd
        className={cn(
          "tabular mt-0.5 text-[15px] font-semibold",
          accent === "brand" ? "text-brand-700" : accent === "negative" ? "text-negative" : "text-ink",
        )}
      >
        {value}
      </dd>
      {sub ? <p className="tabular mt-0.5 text-[11px] text-faint">{sub}</p> : null}
    </div>
  );
}

function RetentionBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? value / total : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[11px] text-faint">{label}</span>
      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-canvas">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-brand"
          style={{ width: `${Math.min(100, pct * 100)}%` }}
        />
      </span>
      <span className="tabular w-24 shrink-0 text-right text-[11px] text-muted">
        {formatNumber(value)} · {formatPercent(pct)}
      </span>
    </div>
  );
}

function VideoBlock({
  row,
  insight,
  loading,
}: {
  row: CreativeRow;
  insight: CreativeInsight | null;
  loading: boolean;
}) {
  const embed = insight?.permalink
    ? `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(insight.permalink)}&show_text=false&width=500&height=280`
    : null;

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-[12px] bg-black">
        {embed ? (
          <iframe
            src={embed}
            title={row.name}
            className="h-full w-full"
            style={{ border: "none" }}
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : row.thumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={row.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/50">
            <Icon name="creative" className="h-8 w-8" />
          </div>
        )}
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[12px] text-white">
            Загружаем ролик…
          </div>
        ) : null}
      </div>

      {row.previewUrl || insight?.permalink ? (
        <a
          href={insight?.permalink ?? row.previewUrl ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-brand-700 transition hover:text-brand"
        >
          <Icon name="play" className="h-3.5 w-3.5" /> Открыть в Meta
        </a>
      ) : null}
    </div>
  );
}

export function CreativeDetailsButton({
  row,
  projectId,
  money,
}: {
  row: CreativeRow;
  projectId: string;
  money: Money;
}) {
  const [open, setOpen] = useState(false);
  const [insight, setInsight] = useState<CreativeInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const { adCurrency, currency, needsRate, rate } = money;
  const meta = STATUS_META[row.verdict];

  const spendShown = needsRate ? row.spendSource : row.spend;
  const spendTenge = needsRate ? `≈ ${formatMoney(row.spendSource * rate, currency)}` : null;
  const adMoney = (v: number) => formatAdMoney(v, adCurrency);
  const cpcSource = row.clicks > 0 ? row.spendSource / row.clicks : null;

  async function openPanel() {
    setOpen(true);
    if (row.mediaType === "video" && !loaded) {
      setLoading(true);
      try {
        setInsight(await fetchCreativeInsight(projectId, row.id));
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        className="rounded-[9px] border border-line px-2.5 py-1 text-[12px] text-muted transition hover:border-brand-200 hover:text-brand-700"
      >
        Детали
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Закрыть"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/30 backdrop-blur-[1px]"
          />
          <aside className="relative z-10 flex h-full w-full max-w-[520px] flex-col overflow-y-auto bg-surface shadow-[var(--shadow-pop)]">
            <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-surface/95 px-5 py-4 backdrop-blur">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  {row.mediaType === "video" ? (
                    <span className="text-[11px] text-faint">Видео</span>
                  ) : null}
                </div>
                <h2 className="mt-1 truncate text-[15px] font-semibold text-ink">{row.name}</h2>
                <p className="truncate text-[11.5px] text-faint">
                  {row.adSetName ?? row.campaignName ?? "Без кампании"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрыть"
                className="shrink-0 rounded-[9px] px-2 py-1 text-[16px] leading-none text-faint transition hover:bg-canvas hover:text-ink"
              >
                ×
              </button>
            </header>

            <div className="flex flex-col gap-5 px-5 py-5">
              <VideoBlock row={row} insight={insight} loading={loading} />

              <p className="rounded-[10px] bg-brand-50 px-3 py-2 text-[12.5px] leading-relaxed text-brand-700">
                {meta.advice}
              </p>

              <section>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-faint">
                  Реклама · кабинет
                </h3>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Metric label="Потрачено" value={adMoney(spendShown)} sub={spendTenge} />
                  <Metric label="Показы" value={formatNumber(row.impressions)} />
                  <Metric label="Клики" value={formatNumber(row.clicks)} />
                  <Metric label="CTR" value={formatPercent(row.ctr, 2)} />
                  <Metric label="Цена клика" value={cpcSource === null ? "—" : adMoney(cpcSource)} />
                  <Metric
                    label="Лиды кабинета"
                    value={formatNumber(row.platformLeads)}
                  />
                  <Metric
                    label="Цена лида"
                    value={row.cplSource === null ? "—" : adMoney(row.cplSource)}
                    accent={row.verdict === "off" ? "negative" : row.verdict === "top" ? "brand" : undefined}
                  />
                </dl>
              </section>

              <section>
                <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-faint">
                  Результат · {currency === "KZT" ? "₸" : currency}
                </h3>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Metric label="Лиды CRM" value={formatNumber(row.leads)} />
                  <Metric label="Квалифицированы" value={formatNumber(row.qualified)} />
                  <Metric label="Продажи" value={formatNumber(row.sales)} accent={row.sales > 0 ? "brand" : undefined} />
                  <Metric label="Выручка" value={formatMoney(row.revenue, currency)} />
                  <Metric label="Конверсия" value={formatPercent(row.conversion)} />
                  <Metric
                    label="Цена клиента"
                    value={row.costPerSale === null ? "—" : formatMoney(row.costPerSale, currency)}
                  />
                  <Metric
                    label="ROMI"
                    value={row.romi === null ? "—" : formatPercent(row.romi)}
                    accent={row.romi !== null && row.romi >= 0 ? "brand" : "negative"}
                  />
                  <Metric label="ROAS" value={formatRatio(row.roas)} />
                  <Metric
                    label="Прибыль"
                    value={formatMoney(row.profit, currency)}
                    accent={row.profit >= 0 ? "brand" : "negative"}
                  />
                </dl>
              </section>

              {row.mediaType === "video" ? (
                <section>
                  <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-faint">
                    Как смотрят ролик
                  </h3>
                  {loading ? (
                    <p className="text-[12.5px] text-faint">Загружаем данные удержания…</p>
                  ) : insight?.hook ? (
                    <div className="flex flex-col gap-3">
                      <dl className="grid grid-cols-3 gap-2">
                        <Metric label="Показы" value={formatNumber(insight.hook.impressions)} />
                        <Metric label="Ср. просмотр" value={`${formatNumber(insight.hook.avgWatch)} с`} />
                        <Metric
                          label="Досмотры (Thruplay)"
                          value={formatNumber(insight.hook.thruplays)}
                        />
                      </dl>
                      <div className="flex flex-col gap-1.5 rounded-[10px] bg-canvas px-3 py-3">
                        <p className="mb-1 text-[11px] text-faint">Удержание (доля от показов)</p>
                        <RetentionBar label="25%" value={insight.hook.p25} total={insight.hook.impressions} />
                        <RetentionBar label="50%" value={insight.hook.p50} total={insight.hook.impressions} />
                        <RetentionBar label="75%" value={insight.hook.p75} total={insight.hook.impressions} />
                        <RetentionBar label="100%" value={insight.hook.p100} total={insight.hook.impressions} />
                      </div>
                      <p className="text-[11.5px] leading-relaxed text-faint">
                        Чем круче падение к 25%, тем слабее «зацеп» первых секунд. Высокий средний
                        просмотр и доля досмотров — признак сильного ролика.
                      </p>
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-faint">
                      Данные удержания недоступны для этого ролика.
                    </p>
                  )}
                </section>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
