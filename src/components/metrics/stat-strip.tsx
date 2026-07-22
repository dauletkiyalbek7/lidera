import { cn } from "@/lib/cn";

export type Stat = {
  key: string;
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
};

/** Компактная полоса показателей над списком раздела. */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="card grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <div
          key={stat.key}
          className={cn(
            "px-5 py-4",
            index > 0 && "sm:border-l sm:border-line",
            index === 2 && "lg:border-l",
          )}
        >
          <p className="text-[12px] text-muted">{stat.label}</p>
          <p
            className={cn(
              "tabular mt-1.5 text-[20px] font-semibold leading-none tracking-tight",
              stat.accent ? "text-brand-700" : "text-ink",
            )}
          >
            {stat.value}
          </p>
          {stat.hint ? <p className="mt-1.5 text-[11.5px] text-faint">{stat.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
