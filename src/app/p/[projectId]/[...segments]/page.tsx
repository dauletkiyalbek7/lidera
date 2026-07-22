import { notFound } from "next/navigation";

import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { requireProjectContext } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import { formatDateRange } from "@/lib/format";
import {
  getSectionByPath,
  isSectionVisible,
  sectionBlockTitle,
  type SectionStage,
} from "@/lib/navigation";

const STAGE_NOTE: Record<SectionStage, string> = {
  ready: "Раздел готов.",
  basic: "Каркас раздела готов, данные подключаем на следующем этапе.",
  later: "Раздел появится позже — структура уже заложена в платформе.",
  postponed: "Раздел отложен: возьмём в работу после отдельного решения.",
};

const STAGE_TONE = {
  ready: "positive",
  basic: "brand",
  later: "muted",
  postponed: "warning",
} as const;

const STAGE_LABEL: Record<SectionStage, string> = {
  ready: "Готово",
  basic: "Каркас",
  later: "Скоро",
  postponed: "Отложено",
};

/**
 * Единая заглушка для разделов, у которых логика появится позже (ТЗ, раздел 7).
 * Реальные страницы разделов кладутся рядом и перекрывают этот маршрут.
 */
export default async function ProjectSectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; segments: string[] }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId, segments } = await params;
  const { niche, role, disabledSectionKeys, deniedSectionKeys } =
    await requireProjectContext(projectId);

  const section = getSectionByPath(segments.join("/"));
  if (
    !section ||
    !isSectionVisible(section, niche, role) ||
    disabledSectionKeys.has(section.key) ||
    deniedSectionKeys.has(section.key)
  ) {
    notFound();
  }

  const range = readDateRange(await searchParams);
  const showDateRange = section.stage !== "postponed";

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle(section.key)}
        title={section.title}
        subtitle={
          showDateRange
            ? `${section.summary} · ${formatDateRange(range.from, range.to)}`
            : section.summary
        }
        actions={
          showDateRange ? (
            <DateRangePicker
              preset={range.preset}
              from={range.from}
              to={range.to}
              label={range.label}
            />
          ) : null
        }
      />

      <div className="card mt-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-canvas text-muted">
              <Icon name={section.icon} className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-[16px] font-semibold text-ink">{section.title}</h2>
              <p className="mt-1 max-w-[620px] text-[13px] leading-relaxed text-muted">
                {STAGE_NOTE[section.stage]}
              </p>
            </div>
          </div>
          <Badge tone={STAGE_TONE[section.stage]}>{STAGE_LABEL[section.stage]}</Badge>
        </div>

        {section.plan && section.plan.length > 0 ? (
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-faint">
              Что здесь будет
            </p>
            <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {section.plan.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] text-muted">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">
                    <Icon name="check" className="h-3 w-3" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </main>
  );
}
