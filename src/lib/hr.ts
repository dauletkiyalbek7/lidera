/**
 * Словарь и расчёты блока «Финансы и HR» (ТЗ, Блок 5).
 * Модель зарплаты: оклад плюс процент от продаж и бонусы за результат.
 */

export const ATTENDANCE_STATUSES = [
  "present",
  "late",
  "absent",
  "dayoff",
  "sick",
  "vacation",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  present: "На месте",
  late: "Опоздал",
  absent: "Прогул",
  dayoff: "Выходной",
  sick: "Больничный",
  vacation: "Отпуск",
};

/** Короткая метка для клетки табеля. */
export const ATTENDANCE_SHORT: Record<AttendanceStatus, string> = {
  present: "•",
  late: "О",
  absent: "П",
  dayoff: "В",
  sick: "Б",
  vacation: "От",
};

export const ATTENDANCE_TONES: Record<AttendanceStatus, "positive" | "warning" | "negative" | "muted"> = {
  present: "positive",
  late: "warning",
  absent: "negative",
  dayoff: "muted",
  sick: "warning",
  vacation: "muted",
};

/** Дни, которые считаются рабочими и оплачиваются. Прогул из оклада вычитается. */
const PAID_STATUSES: readonly AttendanceStatus[] = ["present", "late", "sick", "vacation"];

export function isAttendanceStatus(value: string): value is AttendanceStatus {
  return (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

export function isPaidStatus(status: string): boolean {
  return isAttendanceStatus(status) && PAID_STATUSES.includes(status);
}

/** Понедельник — 1, воскресенье — 7: как в графике работы. */
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export const WEEKDAY_LABELS: Record<number, string> = {
  1: "Понедельник",
  2: "Вторник",
  3: "Среда",
  4: "Четверг",
  5: "Пятница",
  6: "Суббота",
  7: "Воскресенье",
};

export const WEEKDAY_SHORT: Record<number, string> = {
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
  7: "Вс",
};

export const CONTRACT_KINDS = ["employee", "customer", "supplier", "other"] as const;
export type ContractKind = (typeof CONTRACT_KINDS)[number];

export const CONTRACT_KIND_LABELS: Record<ContractKind, string> = {
  employee: "С сотрудником",
  customer: "С клиентом",
  supplier: "С поставщиком",
  other: "Другое",
};

export const CONTRACT_STATUSES = ["draft", "active", "expired", "terminated"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  draft: "Черновик",
  active: "Действует",
  expired: "Истёк",
  terminated: "Расторгнут",
};

export function isContractKind(value: string): value is ContractKind {
  return (CONTRACT_KINDS as readonly string[]).includes(value);
}

export function isContractStatus(value: string): value is ContractStatus {
  return (CONTRACT_STATUSES as readonly string[]).includes(value);
}

/** Правило начисления: оклад за месяц плюс переменная часть. */
export type SalaryRule = {
  baseSalary: number;
  percentOfSales: number;
  perTrial: number;
  perQualifiedLead: number;
};

export const EMPTY_SALARY_RULE: SalaryRule = {
  baseSalary: 0,
  percentOfSales: 0,
  perTrial: 0,
  perQualifiedLead: 0,
};

/** Показатели сотрудника за период — из чего считается переменная часть. */
export type SalaryInputs = {
  /** Сумма закрытых продаж за вычетом возвратов по ним. */
  netSales: number;
  /** Записанные на пробный урок лиды. */
  trials: number;
  /** Квалифицированные лиды: все, кто прошёл дальше статуса «новый». */
  qualifiedLeads: number;
  /** Отмеченных оплачиваемых дней и прогулов — из посещаемости. */
  paidDays: number;
  absentDays: number;
  /** Сколько дней в периоде вообще размечено табелем. */
  markedDays: number;
};

export type SalaryLine = {
  key: string;
  label: string;
  detail: string;
  amount: number;
};

export type SalaryResult = {
  lines: SalaryLine[];
  total: number;
};

/**
 * Оклад за период считаем от месячной ставки пропорционально длине периода,
 * а прогулы вычитаем по дневной ставке — отдельной строкой, чтобы вычет было видно.
 */
const DAYS_IN_MONTH = 30;

export function calculateSalary(
  rule: SalaryRule,
  inputs: SalaryInputs,
  daysInPeriod: number,
  currencyFormatter: (value: number) => string,
): SalaryResult {
  const lines: SalaryLine[] = [];
  const dailyRate = rule.baseSalary / DAYS_IN_MONTH;

  if (rule.baseSalary > 0) {
    lines.push({
      key: "base",
      label: "Оклад",
      detail: `${currencyFormatter(rule.baseSalary)} в месяц × ${daysInPeriod} дн.`,
      amount: dailyRate * daysInPeriod,
    });
  }

  if (rule.baseSalary > 0 && inputs.absentDays > 0) {
    lines.push({
      key: "absent",
      label: "Прогулы",
      detail: `${inputs.absentDays} дн. по ${currencyFormatter(dailyRate)}`,
      amount: -dailyRate * inputs.absentDays,
    });
  }

  if (rule.percentOfSales > 0) {
    lines.push({
      key: "percent",
      label: "Процент от продаж",
      detail: `${rule.percentOfSales} % от ${currencyFormatter(inputs.netSales)}`,
      amount: (inputs.netSales * rule.percentOfSales) / 100,
    });
  }

  if (rule.perTrial > 0) {
    lines.push({
      key: "trials",
      label: "За пробные уроки",
      detail: `${inputs.trials} × ${currencyFormatter(rule.perTrial)}`,
      amount: inputs.trials * rule.perTrial,
    });
  }

  if (rule.perQualifiedLead > 0) {
    lines.push({
      key: "leads",
      label: "За квалифицированные лиды",
      detail: `${inputs.qualifiedLeads} × ${currencyFormatter(rule.perQualifiedLead)}`,
      amount: inputs.qualifiedLeads * rule.perQualifiedLead,
    });
  }

  return {
    lines,
    total: lines.reduce((sum, line) => sum + line.amount, 0),
  };
}
