"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { moveLeadStage } from "@/lib/actions/leads";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { leadSourceLabel, leadStatusLabel } from "@/lib/domain";
import { formatDateShort, formatNumber, formatPercent } from "@/lib/format";

/**
 * CRM-воронка канбаном: карточки лидов таскаются мышкой между этапами (ТЗ, Блок 2).
 * У каждого этапа свой цвет, чтобы стадии не сливались. Перемещение оптимистичное:
 * карточка едет сразу, а сервер догоняет; при ошибке откатываем.
 */

export type KanbanLead = {
  id: string;
  full_name: string;
  phone: string | null;
  source: string | null;
  created_at: string;
  status: string;
  /** Имя ответственного сотрудника — показываем на карточке. */
  assignedName: string | null;
};

/** Инициалы для аватара: одна-две первые буквы имени. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

type Stage = {
  /** Точка/акцент этапа. */
  dot: string;
  /** Верхняя полоса колонки. */
  bar: string;
  /** Мягкий фон шапки. */
  soft: string;
  /** Левый акцент карточки. */
  edge: string;
  text: string;
};

/** Палитра этапов: от «холодного» новичка к «зелёной» продаже. */
const STAGE: Record<string, Stage> = {
  new: { dot: "bg-slate-400", bar: "bg-slate-300", soft: "bg-slate-50", edge: "border-l-slate-300", text: "text-slate-600" },
  qualified: { dot: "bg-sky-500", bar: "bg-sky-400", soft: "bg-sky-50", edge: "border-l-sky-400", text: "text-sky-700" },
  processed: { dot: "bg-sky-500", bar: "bg-sky-400", soft: "bg-sky-50", edge: "border-l-sky-400", text: "text-sky-700" },
  trial_booked: { dot: "bg-amber-500", bar: "bg-amber-400", soft: "bg-amber-50", edge: "border-l-amber-400", text: "text-amber-700" },
  trial_done: { dot: "bg-violet-500", bar: "bg-violet-400", soft: "bg-violet-50", edge: "border-l-violet-400", text: "text-violet-700" },
  sale: { dot: "bg-emerald-500", bar: "bg-emerald-400", soft: "bg-emerald-50", edge: "border-l-emerald-400", text: "text-emerald-700" },
};

const FALLBACK: Stage = {
  dot: "bg-slate-400",
  bar: "bg-slate-300",
  soft: "bg-slate-50",
  edge: "border-l-slate-300",
  text: "text-slate-600",
};

const stageOf = (status: string): Stage => STAGE[status] ?? FALLBACK;

export function KanbanBoard({
  projectId,
  flow,
  leads: initialLeads,
  canEdit,
}: {
  projectId: string;
  flow: readonly string[];
  leads: KanbanLead[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [leads, setLeads] = useState<KanbanLead[]>(initialLeads);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStatus, setOverStatus] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const indexOf = (status: string) => flow.indexOf(status);

  function drop(status: string) {
    const id = dragId;
    setOverStatus(null);
    setDragId(null);
    if (!id) return;

    const lead = leads.find((item) => item.id === id);
    if (!lead || lead.status === status) return;

    const previous = lead.status;
    // Оптимистично: двигаем карточку сразу.
    setLeads((rows) => rows.map((row) => (row.id === id ? { ...row, status } : row)));

    startTransition(async () => {
      const result = await moveLeadStage(projectId, id, status);
      if (!result.ok) {
        setLeads((rows) => rows.map((row) => (row.id === id ? { ...row, status: previous } : row)));
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-6 overflow-x-auto pb-2">
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${flow.length}, minmax(230px, 1fr))` }}
      >
        {flow.map((status, index) => {
          const items = leads.filter((lead) => lead.status === status);
          const reached = leads.filter((lead) => indexOf(lead.status) >= index).length;
          const prevReached =
            index > 0 ? leads.filter((lead) => indexOf(lead.status) >= index - 1).length : null;
          const stepConversion = prevReached && prevReached > 0 ? reached / prevReached : null;
          const stage = stageOf(status);
          const isOver = overStatus === status;

          return (
            <section
              key={status}
              onDragOver={(event) => {
                if (!canEdit || !dragId) return;
                event.preventDefault();
                if (overStatus !== status) setOverStatus(status);
              }}
              onDragLeave={(event) => {
                // Уходим из колонки, только когда курсор реально покинул её.
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setOverStatus((current) => (current === status ? null : current));
                }
              }}
              onDrop={() => drop(status)}
              className={cn(
                "flex flex-col rounded-[16px] transition",
                isOver ? "ring-2 ring-brand-300 ring-offset-2" : "",
              )}
            >
              <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
                <div className={cn("h-1 w-full", stage.bar)} />
                <header className={cn("px-4 py-3", stage.soft)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", stage.dot)} />
                      <h2 className="text-[13px] font-semibold text-ink">
                        {leadStatusLabel(status)}
                      </h2>
                    </span>
                    <span className={cn("tabular text-[13px] font-bold", stage.text)}>
                      {formatNumber(items.length)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-faint">
                    дошло: {formatNumber(reached)}
                    {stepConversion !== null ? ` · ${formatPercent(stepConversion)}` : ""}
                  </p>
                </header>
              </div>

              <ul className="mt-3 flex min-h-[80px] flex-col gap-2">
                {items.map((lead) => (
                  <li
                    key={lead.id}
                    draggable={canEdit}
                    onDragStart={() => setDragId(lead.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStatus(null);
                    }}
                    className={cn(
                      "group rounded-[13px] border border-line border-l-[3px] bg-surface p-3 shadow-[var(--shadow-card)] transition",
                      stage.edge,
                      canEdit
                        ? "cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:border-line hover:shadow-[var(--shadow-pop)]"
                        : "",
                      dragId === lead.id ? "opacity-40" : "",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                          stage.soft,
                          stage.text,
                        )}
                        aria-hidden="true"
                      >
                        {initials(lead.full_name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-ink">
                          {lead.full_name}
                        </p>
                        <p className="tabular mt-0.5 truncate text-[11.5px] text-muted">
                          {lead.phone ?? "телефон не указан"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-line pt-2">
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-faint">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted/50" />
                        <span className="truncate">{leadSourceLabel(lead.source)}</span>
                      </span>
                      <span className="tabular shrink-0 text-[11px] text-faint">
                        {formatDateShort(lead.created_at)}
                      </span>
                    </div>

                    {lead.assignedName ? (
                      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
                        <Icon name="people" className="h-3 w-3 text-faint" />
                        <span className="truncate">{lead.assignedName}</span>
                      </p>
                    ) : null}
                  </li>
                ))}

                {items.length === 0 ? (
                  <li
                    className={cn(
                      "rounded-[12px] border border-dashed px-3.5 py-6 text-center text-[11.5px] transition",
                      isOver ? "border-brand-300 bg-brand-50 text-brand-700" : "border-line text-faint",
                    )}
                  >
                    {isOver ? "отпустите здесь" : "пусто"}
                  </li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>

      {canEdit ? (
        <p className="mt-3 px-1 text-[12px] text-faint">
          Перетаскивайте карточки мышкой между этапами — статус лида меняется сразу.
        </p>
      ) : null}
    </div>
  );
}
