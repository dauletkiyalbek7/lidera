import { DateRangePicker } from "@/components/date-range-picker";
import { AttendanceCell } from "@/components/hr/attendance-cell";
import { GroupLabel, PageHeader } from "@/components/layout/page-header";
import { StatStrip } from "@/components/metrics/stat-strip";
import { Badge } from "@/components/ui/badge";
import { requireSectionAccess } from "@/lib/auth";
import { enumerateDays, readDateRange, today, weekdayOf } from "@/lib/date-range";
import { ROLE_LABELS } from "@/lib/domain";
import { formatDateRange, formatNumber, formatPercent } from "@/lib/format";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_SHORT,
  ATTENDANCE_STATUSES,
  isAttendanceStatus,
  isPaidStatus,
  WEEKDAY_SHORT,
  type AttendanceStatus,
} from "@/lib/hr";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadMembers } from "@/lib/queries/crm";
import { loadAttendance } from "@/lib/queries/hr";

/** Сколько дней помещается в табель: дальше он превращается в бесконечную ленту. */
const MAX_DAYS = 31;

/** Посещаемость: табель по дням периода (ТЗ, Блок 5). */
export default async function AttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { projectId } = await params;
  const range = readDateRange(await searchParams);

  const [{ role, canManage }, members, attendance] = await Promise.all([
    requireSectionAccess(projectId, "attendance"),
    loadMembers(projectId),
    loadAttendance(projectId, range),
  ]);

  const mayMark = canManage || role === "director" || role === "rop";
  const staff = members.filter((member) => member.status === "active");
  const days = enumerateDays(range, MAX_DAYS);
  const currentDate = today();

  // Ключ «сотрудник + день» — по нему клетка находит свою отметку.
  const marks = new Map<string, AttendanceStatus>();
  for (const row of attendance) {
    if (isAttendanceStatus(row.status)) marks.set(`${row.user_id}:${row.date}`, row.status);
  }

  const marked = attendance.length;
  const paid = attendance.filter((row) => isPaidStatus(row.status)).length;
  const absences = attendance.filter((row) => row.status === "absent").length;
  const lates = attendance.filter((row) => row.status === "late").length;

  const stats = [
    {
      key: "marked",
      label: "Отмечено дней",
      value: formatNumber(marked),
      hint: `из ${formatNumber(staff.length * days.length)} возможных`,
    },
    { key: "paid", label: "Оплачиваемых дней", value: formatNumber(paid), accent: true },
    { key: "absences", label: "Прогулов", value: formatNumber(absences) },
    {
      key: "discipline",
      label: "Дисциплина",
      value: formatPercent(marked > 0 ? paid / marked : null),
      hint: `${formatNumber(lates)} опозданий`,
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("attendance")}
        title="Посещаемость"
        subtitle={`Табель отдела · ${formatDateRange(range.from, range.to)}`}
        actions={
          <DateRangePicker
            preset={range.preset}
            from={range.from}
            to={range.to}
            label={range.label}
          />
        }
      />

      <div className="mt-6">
        <StatStrip stats={stats} />
      </div>

      <GroupLabel>Табель</GroupLabel>

      {staff.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <h3 className="text-[15px] font-semibold text-ink">В проекте нет сотрудников</h3>
          <p className="mx-auto mt-1.5 max-w-[440px] text-[13px] leading-relaxed text-muted">
            Примите людей в «Настройки → Сотрудники» — они появятся в табеле.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line bg-canvas/60">
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-canvas px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                >
                  Сотрудник
                </th>
                {days.map((day) => (
                  <th
                    key={day}
                    scope="col"
                    className={`px-1 py-3 text-center text-[10px] font-semibold ${
                      day === currentDate ? "text-brand-700" : "text-faint"
                    }`}
                  >
                    <span className="block">{Number(day.slice(8, 10))}</span>
                    <span className="block font-normal">{WEEKDAY_SHORT[weekdayOf(day)]}</span>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {staff.map((member) => (
                <tr key={member.userId} className="border-b border-line last:border-b-0">
                  <td className="sticky left-0 z-10 bg-surface px-5 py-2.5">
                    <span className="block whitespace-nowrap text-[13px] font-medium text-ink">
                      {member.fullName}
                    </span>
                    <span className="block text-[11px] text-faint">
                      {ROLE_LABELS[member.role]}
                    </span>
                  </td>

                  {days.map((day) => (
                    <td key={day} className="px-1 py-2.5 text-center">
                      <AttendanceCell
                        projectId={projectId}
                        userId={member.userId}
                        date={day}
                        status={marks.get(`${member.userId}:${day}`) ?? null}
                        employeeName={member.fullName}
                        disabled={!mayMark}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[12px] text-faint">
        {ATTENDANCE_STATUSES.map((status) => (
          <span key={status} className="flex items-center gap-2">
            <Badge tone="muted">{ATTENDANCE_SHORT[status]}</Badge>
            {ATTENDANCE_LABELS[status]}
          </span>
        ))}
        {mayMark ? <span>Клик по клетке переключает статус по кругу.</span> : null}
      </div>
    </main>
  );
}
