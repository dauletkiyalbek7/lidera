import { markAttendance } from "@/lib/actions/hr";
import { ATTENDANCE_SHORT, ATTENDANCE_STATUSES, ATTENDANCE_LABELS, type AttendanceStatus } from "@/lib/hr";
import { cn } from "@/lib/cn";

/** По клику отметка переходит к следующему статусу и возвращается к началу круга. */
function nextStatus(current: AttendanceStatus | null): AttendanceStatus {
  if (!current) return ATTENDANCE_STATUSES[0];
  const index = ATTENDANCE_STATUSES.indexOf(current);
  return ATTENDANCE_STATUSES[(index + 1) % ATTENDANCE_STATUSES.length];
}

const CELL_TONE: Record<AttendanceStatus, string> = {
  present: "bg-brand-50 text-brand-700 border-brand-100",
  late: "bg-amber-50 text-amber-700 border-amber-100",
  absent: "bg-rose-50 text-rose-600 border-rose-100",
  dayoff: "bg-canvas text-faint border-line",
  sick: "bg-indigo-50 text-indigo-600 border-indigo-100",
  vacation: "bg-slate-50 text-muted border-line",
};

/**
 * Клетка табеля: обычная форма, без JS.
 * Следующий статус вычислен на сервере, поэтому клик работает и с выключенным JS.
 */
export function AttendanceCell({
  projectId,
  userId,
  date,
  status,
  employeeName,
  disabled,
}: {
  projectId: string;
  userId: string;
  date: string;
  status: AttendanceStatus | null;
  employeeName: string;
  disabled: boolean;
}) {
  const label = status ? ATTENDANCE_LABELS[status] : "Не отмечен";

  return (
    <form action={markAttendance} className="inline-flex">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="status" value={nextStatus(status)} />

      <button
        type="submit"
        disabled={disabled}
        title={`${employeeName} · ${date} · ${label}`}
        aria-label={`${employeeName}, ${date}: ${label}`}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-[8px] border text-[11px] font-medium transition",
          status
            ? CELL_TONE[status]
            : "border-dashed border-line bg-surface text-faint hover:border-brand-200",
          disabled ? "cursor-not-allowed opacity-50" : "hover:opacity-80",
        )}
      >
        {status ? ATTENDANCE_SHORT[status] : "·"}
      </button>
    </form>
  );
}
