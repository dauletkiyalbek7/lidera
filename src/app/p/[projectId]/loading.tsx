import { SectionSkeleton } from "@/components/ui/skeleton";

/**
 * Каркас показывается сразу, пока сервер собирает данные раздела:
 * переход по меню ощущается мгновенным, даже если запрос идёт секунду.
 */
export default function ProjectSectionLoading() {
  return <SectionSkeleton />;
}
