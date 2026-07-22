import { DateRangePicker } from "@/components/date-range-picker";
import { GroupLabel, PageHeader } from "@/components/layout/page-header";
import { StatStrip } from "@/components/metrics/stat-strip";
import { Badge } from "@/components/ui/badge";
import { CardSection } from "@/components/ui/card-section";
import { requireSectionAccess } from "@/lib/auth";
import { daysBetween, readDateRange } from "@/lib/date-range";
import { PROJECT_ROLES, ROLE_LABELS } from "@/lib/domain";
import { currencySymbol, formatDateRange, formatMoney, formatNumber } from "@/lib/format";
import { calculateSalary, type SalaryInputs } from "@/lib/hr";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadMembers } from "@/lib/queries/crm";
import { loadSalaryInputs, loadSalaryRules, resolveSalaryRule } from "@/lib/queries/hr";

import { SalaryRuleDialog, type SalaryTarget } from "./salary-rule-dialog";

const EMPTY_INPUTS: SalaryInputs = {
  netSales: 0,
  trials: 0,
  qualifiedLeads: 0,
  paidDays: 0,
  absentDays: 0,
  markedDays: 0,
};

/** Зарплаты: оклад плюс процент и бонусы за результат (ТЗ, Блок 5). */
export default async function SalariesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  const [{ project, role, canManage }, members, rules, inputsByUser] = await Promise.all([
    requireSectionAccess(projectId, "salaries"),
    loadMembers(projectId),
    loadSalaryRules(projectId),
    loadSalaryInputs(projectId, range),
  ]);

  const currency = project.currency;
  const money = (value: number) => formatMoney(value, currency);
  const mayManage = canManage || role === "director";
  const staff = members.filter((member) => member.status === "active");

  // «За всё время» границ не имеет: считаем оклад за календарный месяц.
  const daysInPeriod =
    range.from && range.to ? daysBetween(range.from, range.to) + 1 : 30;

  const payroll = staff.map((member) => {
    const { rule, source } = resolveSalaryRule(rules, member.userId, member.role);
    const inputs = inputsByUser.get(member.userId) ?? EMPTY_INPUTS;
    return {
      member,
      source,
      inputs,
      result: calculateSalary(rule, inputs, daysInPeriod, money),
    };
  });

  const total = payroll.reduce((sum, row) => sum + row.result.total, 0);
  const withoutRule = payroll.filter((row) => row.source === "none").length;

  const stats = [
    {
      key: "total",
      label: "Фонд оплаты за период",
      value: money(total),
      accent: true,
      hint: formatDateRange(range.from, range.to),
    },
    { key: "staff", label: "Сотрудников в расчёте", value: formatNumber(staff.length) },
    {
      key: "average",
      label: "В среднем на человека",
      value: staff.length > 0 ? money(total / staff.length) : "—",
    },
    {
      key: "norule",
      label: "Без правила начисления",
      value: formatNumber(withoutRule),
      hint: withoutRule > 0 ? "им не начислено ничего" : "правила заданы всем",
    },
  ];

  // Цели для окна правил: сначала роли, потом поимённо.
  const roleTargets: SalaryTarget[] = PROJECT_ROLES.map((projectRole) => {
    const row = rules.find((item) => item.user_id === null && item.role === projectRole);
    return {
      value: `role:${projectRole}`,
      label: `Все: ${ROLE_LABELS[projectRole]}`,
      baseSalary: Number(row?.base_salary ?? 0),
      percentOfSales: Number(row?.percent_of_sales ?? 0),
      perTrial: Number(row?.per_trial ?? 0),
      perQualifiedLead: Number(row?.per_qualified_lead ?? 0),
    };
  });

  const userTargets: SalaryTarget[] = staff.map((member) => {
    const row = rules.find((item) => item.user_id === member.userId);
    return {
      value: `user:${member.userId}`,
      label: `${member.fullName} — лично`,
      baseSalary: Number(row?.base_salary ?? 0),
      percentOfSales: Number(row?.percent_of_sales ?? 0),
      perTrial: Number(row?.per_trial ?? 0),
      perQualifiedLead: Number(row?.per_qualified_lead ?? 0),
    };
  });

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("salaries")}
        title="Зарплаты"
        subtitle={`Оклад, процент от продаж и бонусы за результат · ${formatDateRange(range.from, range.to)}`}
        actions={
          <>
            <DateRangePicker
              preset={range.preset}
              from={range.from}
              to={range.to}
              label={range.label}
            />
            {mayManage ? (
              <SalaryRuleDialog
                projectId={projectId}
                targets={[...roleTargets, ...userTargets]}
                currencyLabel={currencySymbol(currency)}
              />
            ) : null}
          </>
        }
      />

      <div className="mt-6">
        <StatStrip stats={stats} />
      </div>

      <GroupLabel>Начисления по сотрудникам</GroupLabel>

      {staff.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <h3 className="text-[15px] font-semibold text-ink">В проекте нет сотрудников</h3>
          <p className="mx-auto mt-1.5 max-w-[440px] text-[13px] leading-relaxed text-muted">
            Примите людей в «Настройки → Сотрудники» — расчёт появится здесь.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {payroll.map(({ member, source, inputs, result }) => (
            <CardSection
              key={member.userId}
              title={member.fullName}
              hint={ROLE_LABELS[member.role]}
              icon="money"
              action={
                <Badge
                  tone={source === "user" ? "brand" : source === "role" ? "muted" : "warning"}
                >
                  {source === "user"
                    ? "Личное правило"
                    : source === "role"
                      ? "Правило роли"
                      : "Правила нет"}
                </Badge>
              }
            >
              {result.lines.length === 0 ? (
                <p className="text-[13px] text-faint">
                  Начислять нечего: для этого сотрудника не задано правило.
                </p>
              ) : (
                <>
                  <dl className="flex flex-col gap-2.5">
                    {result.lines.map((line) => (
                      <div key={line.key} className="flex items-baseline justify-between gap-3">
                        <dt className="min-w-0">
                          <span className="text-[13px] text-ink">{line.label}</span>
                          <span className="block text-[11.5px] text-faint">{line.detail}</span>
                        </dt>
                        <dd
                          className={`tabular shrink-0 text-[13px] font-medium ${
                            line.amount < 0 ? "text-negative" : "text-ink"
                          }`}
                        >
                          {line.amount < 0 ? "−" : ""}
                          {money(Math.abs(line.amount))}
                        </dd>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-4">
                    <span className="text-[13px] font-semibold text-ink">Итого к выплате</span>
                    <span className="tabular text-[17px] font-semibold text-brand-700">
                      {money(result.total)}
                    </span>
                  </div>
                </>
              )}

              <p className="mt-3 text-[11.5px] text-faint">
                За период: продажи {money(inputs.netSales)} · пробные{" "}
                {formatNumber(inputs.trials)} · квалиф. лиды {formatNumber(inputs.qualifiedLeads)}
                {inputs.markedDays > 0
                  ? ` · табель ${formatNumber(inputs.paidDays)} из ${formatNumber(inputs.markedDays)} дн.`
                  : " · табель не заполнен"}
              </p>
            </CardSection>
          ))}
        </div>
      )}

      <p className="mt-4 px-1 text-[12px] leading-relaxed text-faint">
        Оклад берётся за месяц и делится на 30 дней, поэтому за произвольный период начисляется
        его часть. Прогулы из «Посещаемости» вычитаются отдельной строкой по дневной ставке.
        Продажи считаются по закрывшему сделку сотруднику за вычетом возвратов по ним.
        Расчёт нигде не сохраняется — он всегда пересчитывается из данных проекта.
      </p>
    </main>
  );
}
