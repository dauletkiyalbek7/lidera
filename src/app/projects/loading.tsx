import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectsLoading() {
  return (
    <div className="min-h-screen" aria-busy="true">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-[72px] max-w-[1200px] items-center justify-between px-6">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-10 w-44 rounded-full" />
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-10">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-7 w-52" />
            <Skeleton className="h-3 w-72" />
          </div>
          <Skeleton className="h-11 w-44 rounded-[12px]" />
        </div>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="card flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3.5">
                <Skeleton className="h-11 w-11 rounded-[14px]" />
                <Skeleton className="h-4 flex-1" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="mt-2 h-10 w-full" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
