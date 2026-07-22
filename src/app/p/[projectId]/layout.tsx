import { ProjectShell, type NavGroup } from "@/components/layout/project-shell";
import { UserChip } from "@/components/layout/user-chip";
import { requireProjectContext } from "@/lib/auth";
import { NICHE_LABELS } from "@/lib/domain";
import { buildNavigation, sectionHref } from "@/lib/navigation";

/** Рабочее пространство проекта: меню зависит от ниши и роли (ТЗ, раздел 7). */
export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ projectId: string }>;
  children: React.ReactNode;
}) {
  const { projectId } = await params;
  const { project, niche, role, user, disabledSectionKeys, deniedSectionKeys } =
    await requireProjectContext(projectId);

  const hiddenSectionKeys = new Set([...disabledSectionKeys, ...deniedSectionKeys]);

  const groups: NavGroup[] = buildNavigation(niche, role, hiddenSectionKeys).map(
    (block) => ({
      key: block.key,
      title: block.title,
      items: block.sections.map((section) => ({
        key: section.key,
        title: section.title,
        icon: section.icon,
        stage: section.stage,
        href: sectionHref(projectId, section),
      })),
    }),
  );

  return (
    <ProjectShell
      projectId={projectId}
      projectName={project.name}
      projectHint={NICHE_LABELS[niche]}
      groups={groups}
      userSlot={<UserChip fullName={user.fullName} role={user.globalRole} />}
    >
      {children}
    </ProjectShell>
  );
}
