import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CardSection } from "@/components/ui/card-section";
import { Icon } from "@/components/ui/icon";
import { deleteResource } from "@/lib/actions/resources";
import { requireSectionAccess } from "@/lib/auth";
import { formatDate, formatNumber, plural } from "@/lib/format";
import { sectionBlockTitle } from "@/lib/navigation";
import {
  RESOURCE_KINDS,
  RESOURCE_TYPES,
  isResourceType,
  whatsappLink,
  type ResourceType,
} from "@/lib/resources";
import { loadIntakeState } from "@/lib/queries/intake";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { AddResourceDialog } from "./add-resource-dialog";
import { IntakeCard } from "./intake-card";

/** Ресурсы и воронки: наши номера, сайты и страницы Tilda (ТЗ, Блок 3). */
export default async function ResourcesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { role, canManage } = await requireSectionAccess(projectId, "resources");

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("resources")
    .select("id, type, label, value, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  const resources = data ?? [];
  const mayManage = canManage || role === "director";
  const intake = await loadIntakeState(projectId);

  const byType = new Map<ResourceType, typeof resources>(
    RESOURCE_TYPES.map((type) => [type, []]),
  );
  for (const resource of resources) {
    if (!isResourceType(resource.type)) continue;
    byType.get(resource.type)?.push(resource);
  }

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("resources")}
        title="Ресурсы и воронки"
        subtitle={`${formatNumber(resources.length)} ${plural(resources.length, ["ресурс", "ресурса", "ресурсов"])} проекта: куда ведёт реклама и куда пишут клиенты`}
        actions={mayManage ? <AddResourceDialog projectId={projectId} /> : null}
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {RESOURCE_TYPES.map((type) => {
          const kind = RESOURCE_KINDS[type];
          const items = byType.get(type) ?? [];

          return (
            <CardSection
              key={type}
              title={kind.title}
              hint={kind.summary}
              icon={kind.icon}
              bodyClassName="p-0"
            >
              {items.length === 0 ? (
                <p className="px-5 py-8 text-center text-[12.5px] text-faint">
                  Пока пусто. {mayManage ? "Добавьте первый ресурс." : "Их ведёт директор проекта."}
                </p>
              ) : (
                <ul className="flex flex-col">
                  {items.map((resource) => (
                    <li
                      key={resource.id}
                      className="flex items-center gap-3 border-b border-line px-5 py-3.5 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        {type === "whatsapp" ? (
                          <a
                            href={whatsappLink(resource.value ?? "")}
                            target="_blank"
                            rel="noreferrer"
                            className="tabular text-[13.5px] font-medium text-ink transition hover:text-brand-700"
                          >
                            {resource.value}
                          </a>
                        ) : (
                          <a
                            href={resource.value ?? "#"}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-[13.5px] font-medium text-ink transition hover:text-brand-700"
                          >
                            {resource.value}
                          </a>
                        )}
                        <p className="mt-0.5 truncate text-[11.5px] text-faint">
                          {resource.label ?? "Без подписи"} · добавлен{" "}
                          {formatDate(resource.created_at)}
                        </p>
                      </div>

                      {mayManage ? (
                        <form action={deleteResource}>
                          <input type="hidden" name="project_id" value={projectId} />
                          <input type="hidden" name="resource_id" value={resource.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="ghost"
                            aria-label={`Удалить ресурс ${resource.value}`}
                          >
                            Удалить
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardSection>
          );
        })}
      </div>

      <IntakeCard
        projectId={projectId}
        endpoint={intake.endpoint}
        hint={intake.hint}
        receivedCount={intake.receivedCount}
        lastReceivedAt={intake.lastReceivedAt ? formatDate(intake.lastReceivedAt) : null}
        mayManage={mayManage}
      />

      <div className="card mt-4 flex items-start gap-4 p-5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-canvas text-muted">
          <Icon name="funnel" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-[14px] font-semibold text-ink">Что будет дальше</h2>
          <p className="mt-1 max-w-[760px] text-[13px] leading-relaxed text-muted">
            Сейчас это справочник ресурсов проекта. Дальше номера подключатся к авто-раздаче
            лидов вместо WhatsApp-CAPI, а страницы Tilda начнут сами присылать заявки в раздел
            «Лиды» с проставленным источником.
          </p>
        </div>
      </div>
    </main>
  );
}
