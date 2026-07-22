import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import { createSupabaseServerClient } from "./supabase/server";
import { asGlobalRole, asNiche, type GlobalRole, type Niche } from "./domain";
import { buildNavigation, getSectionByKey, isSectionVisible, sectionHref } from "./navigation";
import type { Tables } from "./database.types";

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string;
  globalRole: GlobalRole;
};

export type ProjectContext = {
  project: Tables<"projects">;
  niche: Niche;
  /** Роль текущего пользователя в этом проекте. */
  role: GlobalRole;
  /** Владелец платформы или создатель проекта: полный доступ. */
  canManage: boolean;
  user: CurrentUser;
  /** Разделы, выключенные тумблерами в настройках проекта. */
  disabledSectionKeys: Set<string>;
  /** Разделы, закрытые для роли пользователя в правах доступа. */
  deniedSectionKeys: Set<string>;
  /** Разделы, где роль пользователя может менять данные. */
  editableSectionKeys: Set<string>;
};

/**
 * Личность пользователя из токена сессии.
 * getClaims() проверяет подпись локально по ключам проекта — это мгновенно,
 * в отличие от getUser(), который каждый раз ходит в Supabase по сети.
 */
async function readUserId(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}

/**
 * Текущий пользователь и его профиль; null, если не вошёл.
 * cache() держит результат на один рендер: layout и страница спрашивают один раз.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const identity = await readUserId();
  if (!identity) return null;

  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, global_role")
    .eq("id", identity.id)
    .maybeSingle();

  return {
    id: identity.id,
    email: identity.email,
    fullName: profile?.full_name ?? identity.email ?? "Пользователь",
    globalRole: asGlobalRole(profile?.global_role ?? "director"),
  };
});

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Загружает проект вместе с ролью текущего пользователя.
 * Чужой проект просто не вернётся из базы — это гарантирует RLS.
 * Все запросы идут параллельно и кэшируются на рендер: layout и страница делят один результат.
 */
export const requireProjectContext = cache(
  async (projectId: string): Promise<ProjectContext> => {
    const identity = await readUserId();
    if (!identity) redirect("/login");

    const supabase = await createSupabaseServerClient();
    const [profileResult, projectResult, membershipResult, sectionsResult, accessResult] =
      await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, global_role")
        .eq("id", identity.id)
        .maybeSingle(),
      supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
      supabase
        .from("project_members")
        .select("role, status")
        .eq("project_id", projectId)
        .eq("user_id", identity.id)
        .maybeSingle(),
      supabase
        .from("project_sections")
        .select("section_key, enabled")
        .eq("project_id", projectId),
      supabase
        .from("access_rights")
        .select("role, section_key, can_view, can_edit")
        .eq("project_id", projectId),
    ]);

    const project = projectResult.data;
    if (!project) notFound();

    const user: CurrentUser = {
      id: identity.id,
      email: identity.email,
      fullName: profileResult.data?.full_name ?? identity.email ?? "Пользователь",
      globalRole: asGlobalRole(profileResult.data?.global_role ?? "director"),
    };

    const membership = membershipResult.data;
    const canManage = user.globalRole === "owner" || project.owner_id === user.id;
    const role: GlobalRole = canManage
      ? "owner"
      : asGlobalRole(membership?.status === "active" ? membership.role : "director");

    const disabledSectionKeys = new Set(
      (sectionsResult.data ?? []).filter((row) => !row.enabled).map((row) => row.section_key),
    );

    // Права роли: строки нет — действует значение по умолчанию для роли.
    // Владелец проекта под ограничения не попадает.
    const roleRights = (accessResult.data ?? []).filter((row) => row.role === role);
    const deniedSectionKeys = canManage
      ? new Set<string>()
      : new Set(roleRights.filter((row) => !row.can_view).map((row) => row.section_key));
    const editableSectionKeys = new Set(
      roleRights.filter((row) => row.can_edit).map((row) => row.section_key),
    );

    return {
      project,
      niche: asNiche(project.niche),
      role,
      canManage,
      user,
      disabledSectionKeys,
      deniedSectionKeys,
      editableSectionKeys,
    };
  },
);

/**
 * Доступ к разделу по прямой ссылке.
 * Скрыть пункт в меню мало: без этой проверки менеджер открыл бы Главную с деньгами
 * или «Сотрудники» с логинами, просто набрав адрес.
 */
export async function requireSectionAccess(
  projectId: string,
  sectionKey: string,
): Promise<ProjectContext> {
  const context = await requireProjectContext(projectId);
  const section = getSectionByKey(sectionKey);

  if (
    !section ||
    !isSectionVisible(section, context.niche, context.role) ||
    context.disabledSectionKeys.has(sectionKey) ||
    context.deniedSectionKeys.has(sectionKey)
  ) {
    notFound();
  }

  return context;
}

/**
 * Первый доступный раздел проекта — куда отправить сотрудника,
 * которому Главная не положена (ТЗ, раздел 7: её видят директор и владелец).
 */
export async function firstAvailableSectionHref(
  context: ProjectContext,
  projectId: string,
): Promise<string> {
  const hidden = new Set([...context.disabledSectionKeys, ...context.deniedSectionKeys]);
  const [firstBlock] = buildNavigation(context.niche, context.role, hidden);
  const section = firstBlock?.sections[0];
  return section ? sectionHref(projectId, section) : "/projects";
}
