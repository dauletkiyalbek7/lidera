import { PageHeader } from "@/components/layout/page-header";
import { StatStrip } from "@/components/metrics/stat-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { setProjectPlan } from "@/lib/actions/projects";
import { requireSectionAccess } from "@/lib/auth";
import { asPlan, PLAN_LABELS } from "@/lib/domain";
import { formatDate, formatNumber, plural } from "@/lib/format";
import { NAV_BLOCKS, sectionBlockTitle } from "@/lib/navigation";
import { PLAN_CARDS, getPlanCard } from "@/lib/plans";
import { loadMembers } from "@/lib/queries/crm";
import { cn } from "@/lib/cn";

/** Тариф проекта (ТЗ, раздел 3, пункт 5). Оплата появится позже. */
export default async function ProjectPlanPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [{ project, canManage, niche, disabledSectionKeys }, members] = await Promise.all([
    requireSectionAccess(projectId, "plan"),
    loadMembers(projectId),
  ]);

  const currentPlan = asPlan(project.plan);
  const currentCard = getPlanCard(currentPlan);
  const staff = members.filter((member) => member.status === "active");

  const sectionsOfNiche = NAV_BLOCKS.flatMap((block) =>
    block.sections.filter((section) => section.niches.includes(niche)),
  );
  const enabledSections = sectionsOfNiche.length - disabledSectionKeys.size;

  const stats = [
    {
      key: "plan",
      label: "Текущий тариф",
      value: PLAN_LABELS[currentPlan],
      accent: true,
      hint: currentCard.price,
    },
    {
      key: "staff",
      label: "Сотрудников в проекте",
      value: currentCard.staffLimit
        ? `${formatNumber(staff.length)} из ${formatNumber(currentCard.staffLimit)}`
        : formatNumber(staff.length),
      hint: currentCard.staffLimit ? "лимит тарифа" : "без ограничения",
    },
    {
      key: "sections",
      label: "Разделов включено",
      value: `${formatNumber(enabledSections)} из ${formatNumber(sectionsOfNiche.length)}`,
    },
    {
      key: "since",
      label: "Проект создан",
      value: formatDate(project.created_at),
      hint: `${formatNumber(staff.length)} ${plural(staff.length, ["человек", "человека", "человек"])} в команде`,
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("plan")}
        title="Тариф"
        subtitle="Что входит в каждый тариф и на каком сейчас проект"
      />

      <div className="mt-6">
        <StatStrip stats={stats} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {PLAN_CARDS.map((card) => {
          const isCurrent = card.key === currentPlan;

          return (
            <section
              key={card.key}
              className={cn(
                "card flex flex-col p-6",
                isCurrent && "ring-1 ring-brand-100",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-semibold tracking-tight text-ink">
                    {card.title}
                  </h2>
                  <p className="mt-1 text-[12.5px] text-faint">{card.tagline}</p>
                </div>
                {isCurrent ? <Badge tone="brand">Текущий</Badge> : null}
              </div>

              <p className="mt-4 text-[20px] font-semibold text-ink">{card.price}</p>

              <ul className="mt-4 flex flex-1 flex-col gap-2.5 border-t border-line pt-4">
                {card.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-[13px] text-muted">
                    <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">
                      <Icon name="check" className="h-3 w-3" />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>

              {canManage ? (
                <form action={setProjectPlan} className="mt-5">
                  <input type="hidden" name="project_id" value={projectId} />
                  <input type="hidden" name="plan" value={card.key} />
                  <Button
                    type="submit"
                    variant={isCurrent ? "secondary" : "primary"}
                    disabled={isCurrent}
                    className="w-full"
                  >
                    {isCurrent ? "Уже подключён" : `Перейти на ${card.title}`}
                  </Button>
                </form>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className="card mt-4 flex items-start gap-4 p-5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-canvas text-muted">
          <Icon name="wallet" className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-[14px] font-semibold text-ink">Оплата пока не подключена</h2>
          <p className="mt-1 max-w-[760px] text-[13px] leading-relaxed text-muted">
            Тариф переключается вручную, и лимиты сейчас ничего не блокируют — они описывают,
            что войдёт в тариф. Приём денег и автоматическое применение лимитов сделаем, когда
            вы решите продавать платформу наружу.
          </p>
        </div>
      </div>
    </main>
  );
}
