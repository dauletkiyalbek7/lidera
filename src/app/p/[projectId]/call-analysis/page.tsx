import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { sectionBlockTitle } from "@/lib/navigation";
import { StatStrip } from "@/components/metrics/stat-strip";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { DataTable, type Column } from "@/components/ui/data-table";
import { requireSectionAccess } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import { formatDateRange, formatDateTime, formatNumber } from "@/lib/format";
import { resolveAiKeys } from "@/lib/ai/keys";
import { loadCalls } from "@/lib/queries/calls";
import { loadCallRubric } from "@/lib/queries/call-rubric";
import { rubricMaxScore } from "@/lib/call-rubric";
import type { Tables } from "@/lib/database.types";

import { AddCallButton } from "./add-call";
import { AnalyzeButton } from "./analyze-button";
import { RubricEditor } from "./rubric-editor";

/** Разбор из calls.breakdown: баллы, обоснования и рубрика на момент оценки. */
type StoredBreakdown = {
  scores?: Record<string, number>;
  notes?: Record<string, string>;
  max?: number;
  criteria?: { key: string; label: string; weight: number }[];
};

/** Длительность звонка в «м:сс». */
function fmtDuration(sec: number): string {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function scoreTone(score: number): "positive" | "warning" | "negative" {
  if (score >= 80) return "positive";
  if (score >= 50) return "warning";
  return "negative";
}

/** Анализ звонков: AI-оценка разговоров менеджеров и продажников (ТЗ, Блок 2). */
export default async function CallAnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  const [{ role, canManage }, calls, keys, rubric] = await Promise.all([
    requireSectionAccess(projectId, "call-analysis"),
    loadCalls(projectId, range),
    resolveAiKeys(projectId),
    loadCallRubric(projectId),
  ]);

  const mayAnalyze = canManage || role === "director" || role === "rop";
  const rubricMax = rubricMaxScore(rubric);
  const scored = calls.filter((call) => call.status === "done" && call.score !== null);
  const avgScore =
    scored.length > 0
      ? Math.round(scored.reduce((sum, call) => sum + (call.score ?? 0), 0) / scored.length)
      : null;

  const stats = [
    { key: "total", label: "Звонков за период", value: formatNumber(calls.length), accent: true },
    { key: "scored", label: "Оценено", value: formatNumber(scored.length) },
    {
      key: "avg",
      label: "Средний балл",
      value: avgScore === null ? "—" : String(avgScore),
      hint: avgScore === null ? undefined : `из ${rubricMax} · по оценённым`,
    },
  ];

  const columns: Column<Tables<"calls">>[] = [
    {
      key: "who",
      header: "Звонок",
      render: (call) => (
        <div className="flex flex-col">
          <span className="tabular font-medium text-ink">{call.phone ?? "без номера"}</span>
          <span className="text-[11.5px] text-faint">
            {fmtDuration(call.duration_sec)} · {formatDateTime(call.created_at)}
          </span>
        </div>
      ),
    },
    {
      key: "score",
      header: "Балл",
      render: (call) => {
        if (call.status === "analyzing") return <Badge tone="info">Разбор…</Badge>;
        if (call.status === "failed") return <Badge tone="negative">Сбой</Badge>;
        if (call.score === null || call.status !== "done")
          return <span className="text-faint">—</span>;
        const bd = (call.breakdown ?? {}) as StoredBreakdown;
        const max = bd.max ?? 100;
        const pct = max > 0 ? (call.score / max) * 100 : 0;
        return (
          <Badge tone={scoreTone(pct)}>
            {call.score} / {max}
          </Badge>
        );
      },
    },
    {
      key: "summary",
      header: "Резюме и разбор",
      hideOnMobile: true,
      render: (call) => {
        const bd = (call.breakdown ?? {}) as StoredBreakdown;
        const criteria = bd.criteria ?? [];
        return (
          <div className="max-w-[440px]">
            {call.summary ? (
              <p className="line-clamp-2 text-[12.5px] text-muted">{call.summary}</p>
            ) : (
              <span className="text-faint">—</span>
            )}
            {criteria.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {criteria.map((c) => (
                  <span
                    key={c.key}
                    className="tabular rounded-full bg-canvas px-2 py-0.5 text-[11px] text-muted"
                    title={bd.notes?.[c.key] ?? c.label}
                  >
                    {c.label}: {bd.scores?.[c.key] ?? 0}/{c.weight}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      },
    },
    ...(mayAnalyze
      ? [
          {
            key: "action",
            header: "",
            align: "right" as const,
            render: (call: Tables<"calls">) =>
              call.status === "done" ? (
                <AnalyzeButton projectId={projectId} callId={call.id} label="Переоценить" />
              ) : (
                <AnalyzeButton projectId={projectId} callId={call.id} label="Оценить" />
              ),
          },
        ]
      : []),
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("call-analysis")}
        title="Анализ звонков"
        subtitle={`AI-оценка разговоров · ${formatDateRange(range.from, range.to)}`}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {mayAnalyze ? <RubricEditor projectId={projectId} rubric={rubric} /> : null}
            {mayAnalyze ? <AddCallButton projectId={projectId} /> : null}
            <DateRangePicker
              preset={range.preset}
              from={range.from}
              to={range.to}
              label={range.label}
            />
          </div>
        }
      />

      {/* Ключи: без OpenAI транскрипция невозможна — честно предупреждаем. */}
      {mayAnalyze && !keys.openai ? (
        <div className="card mt-6 flex items-start gap-3 p-5">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-amber-50 text-amber-700">
            <Icon name="sparkle" className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Не подключён ключ OpenAI</h2>
            <p className="mt-1 max-w-[640px] text-[13px] leading-relaxed text-muted">
              Транскрипция звонков работает через OpenAI (Whisper). Подключите ключ OpenAI в
              «Интеграциях» — свой или платформенный. Оценку можно вести DeepSeek, но текст
              разговора всё равно снимает OpenAI.
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        <StatStrip stats={stats} />
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={calls}
          rowKey={(call) => call.id}
          empty={{
            icon: "calls",
            title: "Звонков пока нет",
            text: "Записи появятся из подключённой CRM (amoCRM/Bitrix) или добавьте запись вручную по ссылке — AI сразу оценит разговор: приветствие, выявление потребности, структуру и закрытие.",
          }}
        />
      </div>
    </main>
  );
}
