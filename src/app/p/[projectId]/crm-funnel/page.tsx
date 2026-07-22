import { DateRangePicker } from "@/components/date-range-picker";
import { PageHeader } from "@/components/layout/page-header";
import { sectionBlockTitle } from "@/lib/navigation";
import { Icon } from "@/components/ui/icon";
import { requireSectionAccess } from "@/lib/auth";
import { readDateRange } from "@/lib/date-range";
import { LEAD_STATUS_FLOW, leadSourceLabel, leadStatusLabel } from "@/lib/domain";
import { formatDateRange, formatDateShort, formatNumber, formatPercent } from "@/lib/format";
import { loadLeads } from "@/lib/queries/crm";

const VISIBLE_CARDS = 8;

/** CRM-воронка: канбан по этапам ниши со счётчиками (ТЗ, Блок 2). */
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
  const [{ niche }, leads] = await Promise.all([
    requireSectionAccess(projectId, "crm-funnel"),
    loadLeads(projectId, range),
  ]);
  const flow = LEAD_STATUS_FLOW[niche];

  const columns = flow.map((status, index) => {
    const items = leads.filter((lead) => lead.status === status);
    const reached = leads.filter((lead) => flow.indexOf(lead.status) >= index);
    const previousReached =
      index > 0 ? leads.filter((lead) => flow.indexOf(lead.status) >= index - 1).length : null;

    return {
      status,
      items,
      reached: reached.length,
      stepConversion:
        previousReached && previousReached > 0 ? reached.length / previousReached : null,
    };
  });

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

      {leads.length === 0 ? (
        <div className="card mt-6 flex flex-col items-center gap-3 px-6 py-14 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-canvas text-muted">
            <Icon name="funnel" className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-ink">За период лидов нет</h3>
            <p className="mx-auto mt-1.5 max-w-[440px] text-[13px] leading-relaxed text-muted">
              Воронка заполнится, как только появятся лиды. Этап меняется в разделе «Лиды».
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto pb-2">
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${flow.length}, minmax(220px, 1fr))` }}
          >
            {columns.map((column) => (
              <section key={column.status} className="flex flex-col">
                <header className="card px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-[13px] font-semibold text-ink">
                      {leadStatusLabel(column.status)}
                    </h2>
                    <span className="tabular text-[13px] font-semibold text-brand-700">
                      {formatNumber(column.items.length)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-faint">
                    дошло до этапа: {formatNumber(column.reached)}
                    {column.stepConversion !== null
                      ? ` · ${formatPercent(column.stepConversion)}`
                      : ""}
                  </p>
                </header>

                <ul className="mt-3 flex flex-col gap-2">
                  {column.items.slice(0, VISIBLE_CARDS).map((lead) => (
                    <li key={lead.id} className="card px-3.5 py-3">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {lead.full_name}
                      </p>
                      <p className="mt-1 flex items-center justify-between gap-2 text-[11px] text-faint">
                        <span>{leadSourceLabel(lead.source)}</span>
                        <span className="tabular">{formatDateShort(lead.created_at)}</span>
                      </p>
                    </li>
                  ))}
                  {column.items.length > VISIBLE_CARDS ? (
                    <li className="px-3.5 py-2 text-[11.5px] text-faint">
                      и ещё {formatNumber(column.items.length - VISIBLE_CARDS)}
                    </li>
                  ) : null}
                  {column.items.length === 0 ? (
                    <li className="rounded-[12px] border border-dashed border-line px-3.5 py-4 text-center text-[11.5px] text-faint">
                      пусто
                    </li>
                  ) : null}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
