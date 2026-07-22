import Link from "next/link";

import { Badge, StatusDot } from "@/components/ui/badge";
import {
  NICHE_LABELS,
  PROJECT_STATUS_LABELS,
  PLAN_LABELS,
  asNiche,
  asPlan,
  asProjectStatus,
} from "@/lib/domain";
import { formatMoney, formatNumber } from "@/lib/format";
import type { Tables } from "@/lib/database.types";

const STATUS_TONE = {
  active: "positive",
  paused: "warning",
  completed: "muted",
} as const;

export type ProjectSummary = {
  revenue: number;
  leads: number;
};

/** Карточка проекта на портале: название, ниша, директор, статус (ТЗ, раздел 1). */
export function ProjectCard({
  project,
  summary,
}: {
  project: Tables<"projects">;
  summary: ProjectSummary;
}) {
  const niche = asNiche(project.niche);
  const status = asProjectStatus(project.status);
  const plan = asPlan(project.plan);

  return (
    <Link
      href={`/p/${project.id}`}
      className="card group flex flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-[0_12px_32px_-16px_rgba(15,23,42,0.22)]"
    >
      <div className="flex items-start gap-3.5">
        <span
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-brand-50 text-[15px] font-semibold text-brand-700"
          style={
            project.accent_color
              ? { backgroundColor: `${project.accent_color}1a`, color: project.accent_color }
              : undefined
          }
        >
          {project.icon ?? project.name.slice(0, 1).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[15px] font-semibold text-ink group-hover:text-brand-700">
            {project.name}
          </h3>
          <p className="mt-0.5 text-[12px] text-faint">{NICHE_LABELS[niche]}</p>
        </div>

        <Badge tone={STATUS_TONE[status]}>
          <StatusDot tone={STATUS_TONE[status]} />
          {PROJECT_STATUS_LABELS[status]}
        </Badge>
      </div>

      <p className="mt-4 line-clamp-2 min-h-[38px] text-[13px] leading-relaxed text-muted">
        {project.description ?? "Описание не заполнено."}
      </p>

      <div className="mt-4 flex items-center gap-2 text-[12px] text-muted">
        <span className="text-faint">Директор:</span>
        <span className="truncate font-medium text-ink">
          {project.director_name ?? "не назначен"}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-line pt-4">
        <div className="flex gap-6">
          <span className="flex flex-col">
            <span className="text-[11px] text-faint">Доход, 7 дней</span>
            <span className="tabular text-[15px] font-semibold text-ink">
              {formatMoney(summary.revenue, project.currency)}
            </span>
          </span>
          <span className="flex flex-col">
            <span className="text-[11px] text-faint">Лиды</span>
            <span className="tabular text-[15px] font-semibold text-ink">
              {formatNumber(summary.leads)}
            </span>
          </span>
        </div>

        <Badge tone={plan === "pro" ? "brand" : "muted"}>{PLAN_LABELS[plan]}</Badge>
      </div>
    </Link>
  );
}
