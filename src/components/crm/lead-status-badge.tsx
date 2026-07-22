import { Badge } from "@/components/ui/badge";
import { leadStatusLabel } from "@/lib/domain";

const STATUS_TONE = {
  new: "muted",
  qualified: "info",
  processed: "info",
  trial_booked: "warning",
  trial_done: "brand",
  sale: "positive",
} as const;

export function LeadStatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status as keyof typeof STATUS_TONE] ?? "neutral";
  return <Badge tone={tone}>{leadStatusLabel(status)}</Badge>;
}
