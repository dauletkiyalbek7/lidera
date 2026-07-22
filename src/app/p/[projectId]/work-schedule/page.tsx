import { GroupLabel, PageHeader } from "@/components/layout/page-header";
import { StatStrip } from "@/components/metrics/stat-strip";
import { setWorkShift } from "@/lib/actions/hr";
import { requireSectionAccess } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/domain";
import { formatNumber, plural } from "@/lib/format";
import { WEEKDAYS, WEEKDAY_LABELS, WEEKDAY_SHORT } from "@/lib/hr";
import { sectionBlockTitle } from "@/lib/navigation";
import { loadMembers } from "@/lib/queries/crm";
import { loadWorkShifts } from "@/lib/queries/hr";

const TIME_CLASS =
  "h-7 w-[68px] rounded-[7px] border border-line bg-surface px-1.5 text-center text-[11px] " +
  "tabular text-ink transition focus:border-brand-200 focus:outline-none";

/** «09:00:00» из базы → «09:00» для поля ввода. */
function toInputTime(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

/** Часы в смене — чтобы показать недельную нагрузку сотрудника. */
function shiftHours(startsAt: string | null, endsAt: string | null): number {
  if (!startsAt || !endsAt) return 0;
  const [startHour, startMinute] = startsAt.split(":").map(Number);
  const [endHour, endMinute] = endsAt.split(":").map(Number);
  const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  return minutes > 0 ? minutes / 60 : 0;
}

/** График работы: повторяющаяся неделя отдела (ТЗ, Блок 5). */
export default async function WorkSchedulePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const [{ role, canManage }, members, shifts] = await Promise.all([
    requireSectionAccess(projectId, "work-schedule"),
    loadMembers(projectId),
    loadWorkShifts(projectId),
  ]);

  const mayEdit = canManage || role === "director" || role === "rop";
  const staff = members.filter((member) => member.status === "active");

  const byCell = new Map(shifts.map((shift) => [`${shift.user_id}:${shift.weekday}`, shift]));

  const hoursByUser = new Map<string, number>();
  for (const shift of shifts) {
    hoursByUser.set(
      shift.user_id,
      (hoursByUser.get(shift.user_id) ?? 0) + shiftHours(shift.starts_at, shift.ends_at),
    );
  }

  const totalHours = [...hoursByUser.values()].reduce((sum, hours) => sum + hours, 0);
  const scheduled = staff.filter((member) => (hoursByUser.get(member.userId) ?? 0) > 0).length;

  const stats = [
    { key: "staff", label: "Сотрудников в графике", value: `${scheduled} из ${staff.length}` },
    {
      key: "hours",
      label: "Часов в неделю",
      value: formatNumber(totalHours, 1),
      accent: true,
      hint: "по всему отделу",
    },
    {
      key: "average",
      label: "В среднем на человека",
      value: scheduled > 0 ? formatNumber(totalHours / scheduled, 1) : "—",
      hint: "часов в неделю",
    },
    {
      key: "empty",
      label: "Без графика",
      value: formatNumber(staff.length - scheduled),
      hint: plural(staff.length - scheduled, ["сотрудник", "сотрудника", "сотрудников"]),
    },
  ];

  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8">
      <PageHeader
        eyebrow={sectionBlockTitle("work-schedule")}
        title="График работы"
        subtitle="Повторяющаяся неделя: смены сотрудников по дням. Пустое время означает выходной"
      />

      <div className="mt-6">
        <StatStrip stats={stats} />
      </div>

      <GroupLabel>Неделя</GroupLabel>

      {staff.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <h3 className="text-[15px] font-semibold text-ink">В проекте нет сотрудников</h3>
          <p className="mx-auto mt-1.5 max-w-[440px] text-[13px] leading-relaxed text-muted">
            Примите людей в «Настройки → Сотрудники» — они появятся в графике.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-line bg-canvas/60">
                <th
                  scope="col"
                  className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                >
                  Сотрудник
                </th>
                {WEEKDAYS.map((weekday) => (
                  <th
                    key={weekday}
                    scope="col"
                    title={WEEKDAY_LABELS[weekday]}
                    className="px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                  >
                    {WEEKDAY_SHORT[weekday]}
                  </th>
                ))}
                <th
                  scope="col"
                  className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] text-muted"
                >
                  Часов
                </th>
              </tr>
            </thead>

            <tbody>
              {staff.map((member) => (
                <tr key={member.userId} className="border-b border-line last:border-b-0">
                  <td className="px-5 py-2.5">
                    <span className="block whitespace-nowrap text-[13px] font-medium text-ink">
                      {member.fullName}
                    </span>
                    <span className="block text-[11px] text-faint">
                      {ROLE_LABELS[member.role]}
                    </span>
                  </td>

                  {WEEKDAYS.map((weekday) => {
                    const shift = byCell.get(`${member.userId}:${weekday}`);
                    const isDayoff = !shift || shift.is_dayoff;

                    return (
                      <td key={weekday} className="px-2 py-2.5 align-top">
                        {mayEdit ? (
                          <form action={setWorkShift} className="flex flex-col items-center gap-1">
                            <input type="hidden" name="project_id" value={projectId} />
                            <input type="hidden" name="user_id" value={member.userId} />
                            <input type="hidden" name="weekday" value={weekday} />
                            <input
                              type="time"
                              name="starts_at"
                              defaultValue={toInputTime(shift?.starts_at ?? null)}
                              aria-label={`${member.fullName}, ${WEEKDAY_LABELS[weekday]}: начало`}
                              className={TIME_CLASS}
                            />
                            <input
                              type="time"
                              name="ends_at"
                              defaultValue={toInputTime(shift?.ends_at ?? null)}
                              aria-label={`${member.fullName}, ${WEEKDAY_LABELS[weekday]}: конец`}
                              className={TIME_CLASS}
                            />
                            <button
                              type="submit"
                              className="text-[10px] font-medium text-brand-700 transition hover:text-brand"
                            >
                              сохранить
                            </button>
                          </form>
                        ) : (
                          <span className="tabular block text-center text-[11.5px] text-muted">
                            {isDayoff
                              ? "—"
                              : `${toInputTime(shift.starts_at)}–${toInputTime(shift.ends_at)}`}
                          </span>
                        )}
                      </td>
                    );
                  })}

                  <td className="tabular px-5 py-2.5 text-right text-[13px] font-semibold text-ink">
                    {formatNumber(hoursByUser.get(member.userId) ?? 0, 1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 px-1 text-[12px] text-faint">
        Оставьте оба поля пустыми и сохраните — день станет выходным.
      </p>
    </main>
  );
}
