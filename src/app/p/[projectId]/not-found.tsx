import { Icon } from "@/components/ui/icon";

/**
 * Раздел не существует или не относится к нише проекта.
 * Например, «Товары (склад)» есть только у товарки, а «Пробные уроки» — только у образования.
 */
export default function ProjectSectionNotFound() {
  return (
    <main className="mx-auto flex max-w-[1200px] flex-col items-center px-5 py-24 text-center lg:px-8">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-canvas text-muted">
        <Icon name="search" className="h-6 w-6" />
      </span>
      <h1 className="mt-5 text-[22px] font-semibold tracking-tight text-ink">
        Раздел не найден
      </h1>
      <p className="mx-auto mt-2.5 max-w-[420px] text-[13px] leading-relaxed text-muted">
        Такого раздела нет либо он не относится к нише этого проекта. Загляните в боковое меню —
        там перечислены только доступные разделы.
      </p>
    </main>
  );
}
