import { cn } from "@/lib/cn";

/** Серый прямоугольник-заглушка на время загрузки данных. */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded-[8px] bg-line", className)} />;
}

/** Каркас страницы раздела: шапка, полоса показателей и таблица. */
export function SectionSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <main className="mx-auto max-w-[1200px] px-5 py-8 lg:px-8" aria-busy="true">
      <div className="flex items-end justify-between gap-4 border-b border-line pb-5">
        <div className="flex w-full max-w-[320px] flex-col gap-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-11 w-[190px] rounded-[12px]" />
      </div>

      <div className="card mt-9 grid gap-6 p-5 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex flex-col gap-2.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>

      <div className="card mt-4 flex flex-col gap-4 p-5">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="hidden h-4 w-28 md:block" />
          </div>
        ))}
      </div>
    </main>
  );
}
