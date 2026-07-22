import { CardSection } from "@/components/ui/card-section";
import { formatNumber, formatPercent } from "@/lib/format";

export type FunnelStage = {
  key: string;
  label: string;
  value: number;
};

/** Воронка ниши: этапы и конверсия между соседними шагами (ТЗ, раздел 6). */
export function Funnel({ stages }: { stages: FunnelStage[] }) {
  const top = Math.max(1, stages[0]?.value ?? 0);

  return (
    <CardSection title="Воронка" hint="Путь лида до продажи за период" icon="funnel">
      <ul className="flex flex-col gap-4">
        {stages.map((stage, index) => {
          const previous = index > 0 ? stages[index - 1].value : null;
          const stepConversion =
            previous && previous > 0 ? stage.value / previous : index === 0 ? null : null;

          return (
            <li key={stage.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-muted">{stage.label}</span>
                <span className="flex items-baseline gap-2">
                  <span className="tabular text-[15px] font-semibold text-ink">
                    {formatNumber(stage.value)}
                  </span>
                  {stepConversion !== null ? (
                    <span className="tabular text-[11px] text-faint">
                      {formatPercent(stepConversion)}
                    </span>
                  ) : null}
                </span>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-canvas">
                <div
                  className="h-full rounded-full bg-brand transition-[width]"
                  style={{
                    width: `${Math.max(2, Math.round((stage.value / top) * 100))}%`,
                    opacity: 1 - index * 0.16,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </CardSection>
  );
}
