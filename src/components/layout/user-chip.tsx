import { signOut } from "@/lib/actions/auth";
import { ROLE_LABELS, type GlobalRole } from "@/lib/domain";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Пользователь и выход. Кнопка выхода — серверное действие, без клиентского JS. */
export function UserChip({
  fullName,
  role,
  className,
}: {
  fullName: string;
  role: GlobalRole;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full border border-line bg-surface py-1 pl-1 pr-3.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-semibold text-brand-700">
          {initials(fullName)}
        </span>
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13px] font-medium text-ink">{fullName}</span>
          <span className="truncate text-[11px] text-faint">{ROLE_LABELS[role]}</span>
        </span>
      </div>

      <form action={signOut}>
        <button
          type="submit"
          title="Выйти"
          aria-label="Выйти"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-muted transition hover:border-rose-100 hover:text-rose-500"
        >
          <Icon name="logout" className="h-[18px] w-[18px]" />
        </button>
      </form>
    </div>
  );
}
