"use server";

import { revalidatePath } from "next/cache";

import { requireProjectContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildLogin, generatePassword } from "@/lib/credentials";
import { isProjectRole, ROLE_LABELS } from "@/lib/domain";

/** Выданные доступы показываем один раз — сохранять их в базе платформы незачем. */
export type EmployeeFormState = {
  error: string | null;
  created: { fullName: string; role: string; login: string; password: string } | null;
};

/**
 * Приём сотрудника: платформа заводит аккаунт и выдаёт логин с паролем (ТЗ, раздел 4).
 * Аккаунт создаётся сервисным ключом — он есть только на сервере.
 */
export async function createEmployee(
  _prevState: EmployeeFormState,
  formData: FormData,
): Promise<EmployeeFormState> {
  const projectId = String(formData.get("project_id") ?? "");
  const { canManage, niche, user } = await requireProjectContext(projectId);

  if (!canManage) {
    return { error: "Добавлять сотрудников может владелец или директор проекта.", created: null };
  }

  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "");

  if (fullName.length < 3) {
    return { error: "Укажите фамилию и имя сотрудника.", created: null };
  }
  if (!isProjectRole(role)) {
    return { error: "Выберите роль сотрудника.", created: null };
  }
  if (niche === "ecommerce" && (role === "salesperson" || role === "rop")) {
    return { error: "Эта роль есть только в проектах ниши «Образование».", created: null };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error:
        "Не задан SUPABASE_SERVICE_ROLE_KEY — без него платформа не может завести аккаунт сотрудника.",
      created: null,
    };
  }

  const admin = createSupabaseAdminClient();
  const password = generatePassword();

  // Тёзка в том же проекте — добавляем к логину номер, чтобы не столкнуться.
  let login = buildLogin(fullName, projectId);
  let created = await admin.auth.admin.createUser({
    email: login,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, global_role: role },
  });

  for (let attempt = 2; created.error && attempt <= 5; attempt += 1) {
    login = buildLogin(fullName, projectId, String(attempt));
    created = await admin.auth.admin.createUser({
      email: login,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, global_role: role },
    });
  }

  if (created.error || !created.data.user) {
    return { error: "Не удалось создать аккаунт сотрудника. Попробуйте ещё раз.", created: null };
  }

  const supabase = await createSupabaseServerClient();
  const { error: memberError } = await supabase.from("project_members").insert({
    project_id: projectId,
    user_id: created.data.user.id,
    role,
  });

  if (memberError) {
    // Аккаунт без места в проекте бесполезен — убираем, чтобы не копить мусор.
    await admin.auth.admin.deleteUser(created.data.user.id);
    return { error: "Не удалось добавить сотрудника в проект.", created: null };
  }

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "member.hired",
    details: { full_name: fullName, role, login },
  });

  revalidatePath(`/p/${projectId}/settings/employees`);

  return {
    error: null,
    created: { fullName, role: ROLE_LABELS[role], login, password },
  };
}

/** Увольнение мягкое: статус fired и дата, данные и история остаются (ТЗ, раздел 3). */
export async function fireEmployee(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const memberId = String(formData.get("member_id") ?? "");

  const { canManage, user } = await requireProjectContext(projectId);
  if (!canManage) return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("project_members")
    .update({ status: "fired", fired_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("project_id", projectId);

  if (error) return;

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "member.fired",
    details: { member_id: memberId },
  });

  revalidatePath(`/p/${projectId}/settings/employees`);
}

/** Возврат сотрудника в строй, если уволили по ошибке. */
export async function restoreEmployee(formData: FormData): Promise<void> {
  const projectId = String(formData.get("project_id") ?? "");
  const memberId = String(formData.get("member_id") ?? "");

  const { canManage, user } = await requireProjectContext(projectId);
  if (!canManage) return;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("project_members")
    .update({ status: "active", fired_at: null })
    .eq("id", memberId)
    .eq("project_id", projectId);

  if (error) return;

  await supabase.from("activity_log").insert({
    project_id: projectId,
    actor_id: user.id,
    action: "member.restored",
    details: { member_id: memberId },
  });

  revalidatePath(`/p/${projectId}/settings/employees`);
}
