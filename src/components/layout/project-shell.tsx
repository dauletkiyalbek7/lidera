"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Icon, type IconName } from "@/components/ui/icon";
import { LogoMark } from "@/components/brand/logo";
import { STAGE_BADGES, type SectionStage } from "@/lib/navigation";
import { cn } from "@/lib/cn";

/** Пункт меню в виде, пригодном для передачи из серверного компонента. */
export type NavItem = {
  key: string;
  title: string;
  icon: IconName;
  href: string;
  stage: SectionStage;
};

export type NavGroup = {
  key: string;
  title: string;
  items: NavItem[];
};

function isActive(pathname: string, href: string, projectHome: string): boolean {
  if (href === projectHome) return pathname === projectHome;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({
  projectName,
  projectHint,
  groups,
  projectHome,
  userSlot,
  onNavigate,
}: {
  projectName: string;
  projectHint: string;
  groups: NavGroup[];
  projectHome: string;
  userSlot: React.ReactNode;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5">
        <Link
          href="/projects"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-[14px] p-2 transition hover:bg-canvas"
        >
          <LogoMark className="h-10 w-10" />
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[14px] font-semibold text-ink">{projectName}</span>
            <span className="truncate text-[11px] text-faint">{projectHint}</span>
          </span>
          <Icon name="chevron" className="ml-auto h-4 w-4 shrink-0 rotate-180 text-faint" />
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {groups.map((group) => (
          <div key={group.key} className="mb-5">
            <p className="px-3 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-faint">
              {group.title}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href, projectHome);
                const badge = STAGE_BADGES[item.stage];
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-[12px] px-3 py-2 text-[13px] transition",
                        active
                          ? "bg-brand-50 font-medium text-brand-700"
                          : "text-muted hover:bg-canvas hover:text-ink",
                      )}
                    >
                      <Icon
                        name={item.icon}
                        className={cn("h-[18px] w-[18px] shrink-0", active && "text-brand")}
                      />
                      <span className="truncate">{item.title}</span>
                      {badge ? (
                        <span className="ml-auto rounded-full bg-canvas px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide text-faint">
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">{userSlot}</div>
    </div>
  );
}

/** Каркас кабинета проекта: боковое меню по блокам и нише (ТЗ, раздел 7). */
export function ProjectShell({
  projectId,
  projectName,
  projectHint,
  groups,
  userSlot,
  children,
}: {
  projectId: string;
  projectName: string;
  projectHint: string;
  groups: NavGroup[];
  userSlot: React.ReactNode;
  children: React.ReactNode;
}) {
  // Ящик закрывается по клику на пункт меню — см. onNavigate ниже.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const projectHome = `/p/${projectId}`;

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] border-r border-line bg-surface lg:block">
        <SidebarContent
          projectName={projectName}
          projectHint={projectHint}
          groups={groups}
          projectHome={projectHome}
          userSlot={userSlot}
        />
      </aside>

      <div className="lg:pl-[264px]">
        <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Открыть меню"
            className="inline-flex h-10 w-10 items-center justify-center rounded-[12px] border border-line text-muted"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path
                d="M4 7h16M4 12h16M4 17h16"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            </svg>
          </button>
          <span className="truncate text-sm font-semibold text-ink">{projectName}</span>
        </div>

        {children}
      </div>

      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 bg-ink/25 backdrop-blur-sm lg:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDrawerOpen(false);
          }}
        >
          <div className="h-full w-[280px] border-r border-line bg-surface">
            <SidebarContent
              projectName={projectName}
              projectHint={projectHint}
              groups={groups}
              projectHome={projectHome}
              userSlot={userSlot}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
