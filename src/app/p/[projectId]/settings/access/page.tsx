import { Fragment } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { AccessCheckbox } from "@/components/ui/toggle";
import { Icon } from "@/components/ui/icon";
import { requireSectionAccess } from "@/lib/auth";
import { setAccessRight } from "@/lib/actions/settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROJECT_ROLES, ROLE_LABELS, type ProjectRole } from "@/lib/domain";
import { formatNumber, plural } from "@/lib/format";
import { NAV_BLOCKS, isSectionVisible, sectionBlockTitle } from "@/lib/navigation";

/** Роли ниши: продажник и РОП есть только у образования. */
const ROLES_BY_NICHE: Record<string, ProjectRole[]> = {
  education: [...PROJECT_ROLES],
  ecommerce: PROJECT_ROLES.filter((role) => role === "director" || role === "manager"),
};

type Right = { canView: boolean; canEdit: boolean; explicit: boolean };

/** Права доступа: таблица «разделы × роли» (ТЗ, Блок 6). */
export default async function AccessRightsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { niche, canManage } = await requireSectionAccess(projectId, "access-rights");

  const supabase = await createSupabaseServerClient();
  const { data: stored } = await supabase
    .from("access_rights")
    .select("role, section_key, can_view, can_edit")
    .eq("project_id", projectId);

  const roles = ROLES_BY_NICHE[niche] ?? [...PROJECT_ROLES];

  const explicit = new Map<string, { canView: boolean; canEdit: boolean }>();
  for (const row of stored ?? []) {
    if (!row.role) continue;
    explicit.set(`${row.role}:${row.section_key}`, {
      canView: row.can_view,
      canEdit: row.can_edit,
    });
  }

  /** Нет строки — работает значение по умолчанию: раздел виден, если он положен роли. */
  function rightFor(role: ProjectRole, sectionKey: string, defaultView: boolean): Right {
    const saved = explicit.get(`${role}:${sectionKey}`);
    if (!saved) return { canView: defaultView, canEdit: false, explicit: false };
    return { canView: saved.canView, canEdit: saved.canEdit, explicit: true };
  }

  const blocks = NAV_BLOCKS.map((block) => ({
    key: block.key,
    title: block.title,
    sections: block.sections.filter((section) => section.niches.includes(niche)),
  })).filter((block) => block.sections.length > 0);

  const visibleCount = new Map<ProjectRole, number>();
  for (const role of roles) {
    let count = 0;
    for (const block of blocks) {
      for (const section of block.sections) {
        const defaultView = isSectionVisible(section, niche, role);
        if (rightFor(role, section.key, defaultView).canView) count += 1;
      }
    }
    visibleCount.set(role, count);
  }

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("access-rights")}
        title="Права доступа"
        subtitle="Кто какие разделы видит и где может менять данные. Владелец и директор проекта видят всё всегда"
      />

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {roles.map((role) => (
          <div key={role} className="card p-5">
            <p className="text-[13px] text-muted">{ROLE_LABELS[role]}</p>
            <p className="tabular mt-2 text-[22px] font-semibold leading-none text-ink">
              {formatNumber(visibleCount.get(role) ?? 0)}
            </p>
            <p className="mt-2 text-[11.5px] text-faint">
              {plural(visibleCount.get(role) ?? 0, [
                "доступный раздел",
                "доступных раздела",
                "доступных разделов",
              ])}
            </p>
          </div>
        ))}
      </section>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-line bg-canvas/60">
              <th
                scope="col"
                className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
              >
                Раздел
              </th>
              {roles.map((role) => (
                <th
                  key={role}
                  scope="col"
                  className="px-5 py-3.5 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                >
                  {ROLE_LABELS[role]}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {blocks.map((block) => (
              <Fragment key={block.key}>
                <tr className="bg-canvas/40">
                  <td
                    colSpan={roles.length + 1}
                    className="px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-faint"
                  >
                    {block.title}
                  </td>
                </tr>

                {block.sections.map((section) => (
                  <tr key={section.key} className="border-b border-line last:border-b-0">
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2.5">
                        <Icon name={section.icon} className="h-4 w-4 shrink-0 text-faint" />
                        <span className="text-[13px] text-ink">{section.title}</span>
                      </span>
                    </td>

                    {roles.map((role) => {
                      const defaultView = isSectionVisible(section, niche, role);
                      const right = rightFor(role, section.key, defaultView);
                      const isDirector = role === "director";

                      return (
                        <td key={role} className="px-5 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <AccessCheckbox
                              action={setAccessRight}
                              fields={{
                                project_id: projectId,
                                section_key: section.key,
                                role,
                                can_view: right.canView ? "false" : "true",
                                can_edit: right.canEdit ? "true" : "false",
                              }}
                              checked={right.canView}
                              disabled={!canManage || isDirector}
                              label={`${ROLE_LABELS[role]} видит «${section.title}»`}
                            />
                            <AccessCheckbox
                              action={setAccessRight}
                              fields={{
                                project_id: projectId,
                                section_key: section.key,
                                role,
                                can_view: right.canView ? "true" : "false",
                                can_edit: right.canEdit ? "false" : "true",
                              }}
                              checked={right.canEdit}
                              disabled={!canManage || isDirector || !right.canView}
                              label={`${ROLE_LABELS[role]} правит «${section.title}»`}
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 px-1 text-[12px] text-faint">
        <span className="flex items-center gap-2">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-[5px] bg-brand" />
          первая галочка — видит раздел
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-[5px] border border-line" />
          вторая — может менять данные
        </span>
        <span>Директор проекта видит все разделы, его права не ограничиваются.</span>
      </div>
    </main>
  );
}
