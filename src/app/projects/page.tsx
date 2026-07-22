import { Logo } from "@/components/brand/logo";
import { PageHeader } from "@/components/layout/page-header";
import { UserChip } from "@/components/layout/user-chip";
import { Icon } from "@/components/ui/icon";
import { requireCurrentUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addDays, today } from "@/lib/date-range";
import { plural } from "@/lib/format";

import { CreateProjectDialog } from "./create-project-dialog";
import { ProjectCard, type ProjectSummary } from "./project-card";

const SUMMARY_WINDOW_DAYS = 7;

/** Портал-вход «Мои проекты» (ТЗ, раздел 1). Список ограничен политиками RLS. */
export default async function ProjectsPage() {
  const user = await requireCurrentUser();
  const supabase = await createSupabaseServerClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  const summaryFrom = addDays(today(), -(SUMMARY_WINDOW_DAYS - 1));
  const { data: metrics } = await supabase
    .from("metrics_daily")
    .select("project_id, leads, revenue")
    .gte("date", summaryFrom);

  const summaries = new Map<string, ProjectSummary>();
  for (const row of metrics ?? []) {
    const current = summaries.get(row.project_id) ?? { revenue: 0, leads: 0 };
    summaries.set(row.project_id, {
      revenue: current.revenue + Number(row.revenue),
      leads: current.leads + row.leads,
    });
  }

  const list = projects ?? [];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-6">
          <Logo subtitle="Портал проектов" />
          <UserChip fullName={user.fullName} role={user.globalRole} />
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-10">
        <PageHeader
          eyebrow="Портал"
          title="Мои проекты"
          subtitle={
            list.length > 0
              ? `${list.length} ${plural(list.length, ["проект", "проекта", "проектов"])} — каждый со своим кабинетом и данными`
              : "Создайте первый проект, чтобы открыть рабочее пространство"
          }
          actions={<CreateProjectDialog />}
        />

        {list.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                summary={summaries.get(project.id) ?? { revenue: 0, leads: 0 }}
              />
            ))}
          </div>
        ) : (
          <div className="card mt-8 flex flex-col items-center gap-4 px-6 py-16 text-center">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-brand-50 text-brand">
              <Icon name="building" className="h-6 w-6" />
            </span>
            <div>
              <h2 className="text-[17px] font-semibold text-ink">Пока ни одного проекта</h2>
              <p className="mx-auto mt-1.5 max-w-[420px] text-[13px] leading-relaxed text-muted">
                Проект — это отдельный кабинет клиента: свои лиды, продажи, метрики и
                сотрудники. Данные проектов не пересекаются.
              </p>
            </div>
            <CreateProjectDialog />
          </div>
        )}
      </main>
    </div>
  );
}
