import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

export type Column<T> = {
  key: string;
  header: string;
  align?: "left" | "right";
  /** Скрыть колонку на узких экранах, чтобы таблица не разъезжалась. */
  hideOnMobile?: boolean;
  render: (row: T) => React.ReactNode;
};

/** Общая таблица разделов: одна разметка на все списки платформы. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
}: {
  columns: Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  empty: { icon: IconName; title: string; text: string };
}) {
  if (rows.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-canvas text-muted">
          <Icon name={empty.icon} className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-[15px] font-semibold text-ink">{empty.title}</h3>
          <p className="mx-auto mt-1.5 max-w-[440px] text-[13px] leading-relaxed text-muted">
            {empty.text}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse">
        <thead>
          <tr className="border-b border-line bg-canvas/60">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-5 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted",
                  column.align === "right" ? "text-right" : "text-left",
                  column.hideOnMobile && "hidden md:table-cell",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-line last:border-b-0 transition hover:bg-canvas/70"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-5 py-3.5 text-[13px] text-ink",
                    column.align === "right" ? "text-right" : "text-left",
                    column.hideOnMobile && "hidden md:table-cell",
                  )}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
