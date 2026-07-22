import { PageHeader } from "@/components/layout/page-header";
import { CardSection } from "@/components/ui/card-section";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { ToggleForm } from "@/components/ui/toggle";
import { requireSectionAccess } from "@/lib/auth";
import { toggleProjectSection } from "@/lib/actions/settings";
import {
  LOCKED_SECTION_KEYS,
  NAV_BLOCKS,
  STAGE_BADGES,
  sectionBlockTitle,
} from "@/lib/navigation";

/** Настройки → Разделы проекта: какие разделы включены на этом проекте (ТЗ, Блок 6). */
export default async function ProjectSectionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { niche, canManage, disabledSectionKeys } = await requireSectionAccess(projectId, "settings-sections");

  const blocks = NAV_BLOCKS.map((block) => ({
    key: block.key,
    title: block.title,
    sections: block.sections.filter((section) => section.niches.includes(niche)),
  })).filter((block) => block.sections.length > 0);

  const total = blocks.reduce((sum, block) => sum + block.sections.length, 0);
  const enabled = total - disabledSectionKeys.size;

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("settings-sections")}
        title="Разделы проекта"
        subtitle={`Включено ${enabled} из ${total} разделов ниши. Выключенный раздел исчезает из меню у всех сотрудников`}
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {blocks.map((block) => (
          <CardSection key={block.key} title={block.title} bodyClassName="p-0">
            <ul className="flex flex-col">
              {block.sections.map((section) => {
                const locked = (LOCKED_SECTION_KEYS as readonly string[]).includes(section.key);
                const isEnabled = !disabledSectionKeys.has(section.key);
                const badge = STAGE_BADGES[section.stage];

                return (
                  <li
                    key={section.key}
                    className="flex items-center gap-4 border-b border-line px-5 py-3.5 last:border-b-0"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-canvas text-muted">
                      <Icon name={section.icon} className="h-[18px] w-[18px]" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                        {section.title}
                        {badge ? <Badge tone="muted">{badge}</Badge> : null}
                      </p>
                      <p className="mt-0.5 truncate text-[11.5px] text-faint">
                        {locked ? "Базовый раздел, выключить нельзя" : section.summary}
                      </p>
                    </div>

                    <ToggleForm
                      action={toggleProjectSection}
                      fields={{ project_id: projectId, section_key: section.key }}
                      checked={isEnabled}
                      disabled={!canManage || locked}
                      label={`Раздел «${section.title}»`}
                    />
                  </li>
                );
              })}
            </ul>
          </CardSection>
        ))}
      </div>
    </main>
  );
}
