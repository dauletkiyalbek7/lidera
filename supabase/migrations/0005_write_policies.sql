-- Точечные права записи по ролям (ТЗ, раздел 9: добавляем по мере появления экранов).
-- До этой миграции писать мог только владелец платформы и владелец проекта.

-- Активный участник проекта с одной из перечисленных ролей.
create or replace function has_project_role(pid uuid, roles text[]) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from project_members
    where project_id = pid
      and user_id = auth.uid()
      and status = 'active'
      and role = any(roles)
  );
$$;

revoke execute on function public.has_project_role(uuid, text[]) from public, anon;
grant execute on function public.has_project_role(uuid, text[]) to authenticated;

-- Возвраты оформляет РОП или директор (ТЗ, раздел 4).
-- Только insert: история возвратов не редактируется и не удаляется.
create policy returns_rop_insert on returns for insert to authenticated
  with check (has_project_role(project_id, array['director','rop']));

-- Журнал действий: участник может записать только собственное действие.
-- Читать журнал он по-прежнему может лишь в рамках своего проекта.
create policy activity_log_member_insert on activity_log for insert to authenticated
  with check (is_project_member(project_id) and actor_id = auth.uid());

-- Ресурсы и интеграции ведёт директор проекта.
create policy resources_director on resources for all to authenticated
  using (has_project_role(project_id, array['director']))
  with check (has_project_role(project_id, array['director']));

create policy integrations_director on integrations for all to authenticated
  using (has_project_role(project_id, array['director']))
  with check (has_project_role(project_id, array['director']));
