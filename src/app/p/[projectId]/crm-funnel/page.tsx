import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { sectionBlockTitle } from "@/lib/navigation";
import { Icon } from "@/components/ui/icon";
import { requireSectionAccess } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import { LEAD_STATUS_FLOW } from "@/lib/domain";
import { formatDateRange } from "@/lib/format";
import { loadLeads } from "@/lib/queries/crm";

import { KanbanBoard, type KanbanLead } from "./kanban-board";

/** CRM-воронка: канбан по этапам ниши с перетаскиванием карточек (ТЗ, Блок 2). */
export default async function CrmFunnelPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  // Контекст проекта и данные раздела независимы — уходят одной параллельной волной.
  const [{ niche, role, canManage }, leads] = await Promise.all([
    requireSectionAccess(projectId, "crm-funnel"),
    loadLeads(projectId, range),
  ]);
  const flow = LEAD_STATUS_FLOW[niche];
  const canEdit = canManage || role === "director" || role === "rop";

  const cards: KanbanLead[] = leads.map((lead) => ({
    id: lead.id,
    full_name: lead.full_name,
    phone: lead.phone,
    source: lead.source,
    created_at: lead.created_at,
    status: lead.status,
  }));

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("crm-funnel")}
        title="CRM-воронка"
        subtitle={`Этапы сделки · ${formatDateRange(range.from, range.to)}`}
        actions={
          <DateRangePicker
            preset={range.preset}
            from={range.from}
            to={range.to}
            label={range.label}
          />
        }
      />

      {cards.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-canvas text-muted">
            <Icon name="funnel" className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-ink">За период лидов нет</h3>
            <p className="mx-auto mt-1.5 max-w-[440px] text-[13px] leading-relaxed text-muted">
              Воронка заполнится, как только появятся лиды. Карточки можно будет перетаскивать
              между этапами.
            </p>
          </div>
        </div>
      ) : (
        <KanbanBoard projectId={projectId} flow={flow} leads={cards} canEdit={canEdit} />
      )}
    </main>
  );
}
