import { PageHeader } from "@/components/layout/page-header";
import { StatStrip } from "@/components/metrics/stat-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { requireSectionAccess } from "@/lib/auth";
import { fireEmployee, restoreEmployee } from "@/lib/actions/employees";
import { PROJECT_ROLES, ROLE_LABELS, type ProjectRole } from "@/lib/domain";
import { formatDate, formatNumber } from "@/lib/format";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadMembers, type Member } from "@/lib/queries/crm";
import { hasServiceRoleKey, loadLogins } from "@/lib/queries/employees";

import { AddEmployeeDialog } from "./add-employee-dialog";

/** Роли, доступные в нише: продажник и РОП есть только у образования (ТЗ, раздел 4). */
const ROLES_BY_NICHE: Record<string, ProjectRole[]> = {
  education: [...PROJECT_ROLES],
  ecommerce: PROJECT_ROLES.filter((role) => role === "director" || role === "manager"),
};

type EmployeeRow = Member & { login: string };

/** Настройки → Сотрудники: приём, роли, мягкое увольнение (ТЗ, Блок 6). */
export default async function EmployeesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [{ niche, canManage }, members, logins] = await Promise.all([
    requireSectionAccess(projectId, "settings-employees"),
    loadMembers(projectId),
    loadLogins(),
  ]);

  const rows: EmployeeRow[] = members.map((member) => ({
    ...member,
    login: logins.get(member.userId) || "—",
  }));

  const active = rows.filter((row) => row.status === "active");
  const fired = rows.filter((row) => row.status === "fired");

  const stats = [
    { key: "active", label: "Работают сейчас", value: formatNumber(active.length), accent: true },
    {
      key: "managers",
      label: "Менеджеров",
      value: formatNumber(active.filter((row) => row.role === "manager").length),
    },
    {
      key: "sales",
      label: niche === "education" ? "Продажников" : "Директоров",
      value: formatNumber(
        active.filter((row) => row.role === (niche === "education" ? "salesperson" : "director"))
          .length,
      ),
    },
    { key: "fired", label: "Уволены", value: formatNumber(fired.length), hint: "история сохранена" },
  ];

  const columns: Column<EmployeeRow>[] = [
    {
      key: "name",
      header: "Сотрудник",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-ink">{row.fullName}</span>
          <span className="text-[11.5px] text-faint">{row.login}</span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Роль",
      render: (row) => <Badge tone="neutral">{ROLE_LABELS[row.role]}</Badge>,
    },
    {
      key: "hired",
      header: "Принят",
      hideOnMobile: true,
      render: (row) => <span className="tabular text-muted">{formatDate(row.hiredAt)}</span>,
    },
    {
      key: "status",
      header: "Статус",
      render: (row) =>
        row.status === "active" ? (
          <Badge tone="positive">Работает</Badge>
        ) : (
          <Badge tone="muted">
            Уволен{row.firedAt ? ` · ${formatDate(row.firedAt)}` : ""}
          </Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) =>
        !canManage ? null : row.status === "active" ? (
          <form action={fireEmployee}>
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="member_id" value={row.id} />
            <Button type="submit" variant="danger" size="sm">
              Уволить
            </Button>
          </form>
        ) : (
          <form action={restoreEmployee}>
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="member_id" value={row.id} />
            <Button type="submit" variant="secondary" size="sm">
              Вернуть
            </Button>
          </form>
        ),
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("settings-employees")}
        title="Сотрудники"
        subtitle="Платформа выдаёт логин и пароль; увольнение мягкое — данные и история остаются"
        actions={
          canManage ? (
            <AddEmployeeDialog
              projectId={projectId}
              roles={ROLES_BY_NICHE[niche] ?? [...PROJECT_ROLES]}
              disabledReason={
                hasServiceRoleKey()
                  ? null
                  : "Чтобы заводить сотрудников, добавьте SUPABASE_SERVICE_ROLE_KEY в .env.local"
              }
            />
          ) : null
        }
      />

      <div className="mt-6">
        <StatStrip stats={stats} />
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty={{
            icon: "people",
            title: "В проекте пока только вы",
            text: "Добавьте сотрудников — платформа создаст им доступы, а их показатели появятся в кабинетах и топах на Главной.",
          }}
        />
      </div>

      <p className="mt-3 px-1 text-[12px] leading-relaxed text-faint">
        Уволенный сотрудник теряет доступ к проекту, но его лиды, продажи и отчёты остаются в
        истории — это нужно для отчётов и расчёта зарплат.
      </p>
    </main>
  );
}
