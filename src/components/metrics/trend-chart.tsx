import { CardSection } from "@/components/ui/card-section";
import { formatDateShort, formatMoney } from "@/lib/format";

export type TrendPoint = {
  date: string;
  revenue: number;
  adSpend: number;
};

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 300;
const GRID_LINES = 4;

function buildPath(values: number[], max: number, close: boolean): string {
  if (values.length === 0) return "";
  const stepX = values.length > 1 ? VIEW_WIDTH / (values.length - 1) : 0;
  const toY = (value: number) => VIEW_HEIGHT - (max === 0 ? 0 : (value / max) * VIEW_HEIGHT);

  const line = values
    .map((value, index) => `${index === 0 ? "M" : "L"}${index * stepX},${toY(value)}`)
    .join(" ");

  if (!close) return line;
  const lastX = (values.length - 1) * stepX;
  return `${line} L${lastX},${VIEW_HEIGHT} L0,${VIEW_HEIGHT} Z`;
}

/** Динамика дохода и расхода за период. Данные — из metrics_daily. */
export function TrendChart({
  points,
  currency,
}: {
  points: TrendPoint[];
  currency: string;
}) {
  const revenues = points.map((point) => point.revenue);
  const spends = points.map((point) => point.adSpend);
  const max = Math.max(1, ...revenues, ...spends);

  const gridValues = Array.from(
    { length: GRID_LINES + 1 },
    (_, index) => (max / GRID_LINES) * (GRID_LINES - index),
  );

  const xLabels =
    points.length > 1
      ? [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]]
      : points;

  const legend = (
    <div className="flex items-center gap-4 text-[12px]">
      <span className="flex items-center gap-2 text-muted">
        <span className="h-2 w-2 rounded-full bg-brand" />
        Доход
      </span>
      <span className="flex items-center gap-2 text-muted">
        <span className="h-2 w-2 rounded-full bg-slate-300" />
        Расход
      </span>
    </div>
  );

  return (
    <CardSection
      title="Динамика дохода и расхода"
      hint="По дням выбранного периода"
      icon="chart"
      action={legend}
    >
      {points.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-faint">
          За выбранный период данных нет
        </p>
      ) : (
        <>
          <div className="flex gap-4">
            <div className="flex h-[220px] w-[86px] shrink-0 flex-col justify-between text-right">
              {gridValues.map((value, index) => (
                <span key={index} className="tabular text-[11px] leading-none text-faint">
                  {formatMoney(value, currency, { compact: true })}
                </span>
              ))}
            </div>

            <div className="relative h-[220px] flex-1">
              <div className="absolute inset-0 flex flex-col justify-between">
                {gridValues.map((_, index) => (
                  <span key={index} className="block h-px w-full bg-line" />
                ))}
              </div>

              <svg
                viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full overflow-visible"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#08d08d" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#08d08d" stopOpacity="0" />
                  </linearGradient>
                </defs>

                <path d={buildPath(revenues, max, true)} fill="url(#revenue-fill)" />
                <path
                  d={buildPath(spends, max, false)}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth={2}
                  strokeDasharray="6 5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={buildPath(revenues, max, false)}
                  fill="none"
                  stroke="#08d08d"
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>
          </div>

          <div className="ml-[102px] mt-3 flex justify-between text-[11px] text-faint">
            {xLabels.map((point, index) => (
              <span key={`${point.date}-${index}`}>{formatDateShort(point.date)}</span>
            ))}
          </div>
        </>
      )}
    </CardSection>
  );
}
