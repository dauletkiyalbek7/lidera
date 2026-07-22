import { CardSection } from "@/components/ui/card-section";
import { Icon } from "@/components/ui/icon";
import { formatMoney, formatNumber, formatRatio, plural } from "@/lib/format";
import { deriveMetrics, sumMetrics, type MetricsRow } from "@/lib/metrics";
import { isLowStock, isOutOfStock, type Product } from "@/lib/inventory";

const MAX_NAMED_PRODUCTS = 3;

type Line = { key: string; text: string; tone: "neutral" | "good" | "warn" };

function buildLines(
  today: MetricsRow | null,
  products: readonly Product[],
  currency: string,
): Line[] {
  const lines: Line[] = [];

  if (!today || today.leads === 0) {
    lines.push({
      key: "quiet",
      text: "Сегодня заявок пока нет — цифры появятся, как только придут первые лиды.",
      tone: "neutral",
    });
  } else {
    const metrics = deriveMetrics(sumMetrics([today]));
    lines.push({
      key: "leads",
      text: `Сегодня пришло ${formatNumber(metrics.leads)} ${plural(metrics.leads, ["лид", "лида", "лидов"])} по цене ${formatMoney(metrics.costPerLead ?? 0, currency)} за лид.`,
      tone: "neutral",
    });

    if (metrics.sales > 0) {
      lines.push({
        key: "sales",
        text: `Продаж ${formatNumber(metrics.sales)} на ${formatMoney(metrics.revenue, currency)}, средний чек ${formatMoney(metrics.averageCheck ?? 0, currency)}.`,
        tone: "good",
      });
    } else {
      lines.push({
        key: "no-sales",
        text: "Продаж сегодня ещё нет — стоит проверить, разобраны ли новые заявки.",
        tone: "warn",
      });
    }

    if (metrics.adSpend > 0) {
      lines.push({
        key: "roas",
        text: `Расход на рекламу ${formatMoney(metrics.adSpend, currency)}, окупаемость ${formatRatio(metrics.roas)}.`,
        tone: (metrics.roas ?? 0) >= 1 ? "good" : "warn",
      });
    }
  }

  const outOfStock = products.filter(isOutOfStock);
  const lowStock = products.filter(isLowStock);

  if (outOfStock.length > 0) {
    lines.push({
      key: "out",
      text: `Закончились: ${outOfStock.slice(0, MAX_NAMED_PRODUCTS).map((p) => p.name).join(", ")}${outOfStock.length > MAX_NAMED_PRODUCTS ? ` и ещё ${outOfStock.length - MAX_NAMED_PRODUCTS}` : ""}.`,
      tone: "warn",
    });
  }

  if (lowStock.length > 0) {
    lines.push({
      key: "low",
      text: `Заканчиваются: ${lowStock.slice(0, MAX_NAMED_PRODUCTS).map((p) => `${p.name} (${formatNumber(p.stock_quantity)} шт)`).join(", ")}.`,
      tone: "warn",
    });
  }

  if (products.length > 0 && outOfStock.length === 0 && lowStock.length === 0) {
    lines.push({ key: "stock-ok", text: "Со складом всё в порядке, дефицита нет.", tone: "good" });
  }

  return lines;
}

const TONE_CLASS = {
  neutral: "bg-canvas text-muted",
  good: "bg-brand-50 text-brand-700",
  warn: "bg-amber-50 text-amber-700",
} as const;

/** Живая сводка дня (ТЗ, раздел 6.2). Пока текст по своим цифрам, позже — AI. */
export function DailyDigest({
  today,
  products,
  currency,
}: {
  today: MetricsRow | null;
  products: readonly Product[];
  currency: string;
}) {
  const lines = buildLines(today, products, currency);

  return (
    <CardSection
      title="Живая сводка дня"
      hint="Собрана по вашим цифрам за сегодня; позже её будет писать AI"
      icon="sparkle"
    >
      <ul className="flex flex-col gap-2.5">
        {lines.map((line) => (
          <li key={line.key} className="flex items-start gap-3">
            <span
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${TONE_CLASS[line.tone]}`}
            >
              <Icon
                name={line.tone === "warn" ? "returns" : "check"}
                className="h-3 w-3"
              />
            </span>
            <span className="text-[13px] leading-relaxed text-muted">{line.text}</span>
          </li>
        ))}
      </ul>
    </CardSection>
  );
}
