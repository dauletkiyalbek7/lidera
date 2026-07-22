-- Lidera — RLS и изоляция проектов (ТЗ, раздел 9).
-- Пользователь физически не видит строки чужого проекта: это гарантирует Postgres, а не код.

-- Владелец платформы: видит и меняет всё.
create or replace function is_owner() returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from profiles where id = auth.uid() and global_role = 'owner');
$$;

-- Активный участник конкретного проекта.
create or replace function is_project_member(pid uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (
    select 1 from project_members
    where project_id = pid and user_id = auth.uid() and status = 'active'
  );
$$;

-- Владелец проекта (создатель кабинета) — полный доступ к своему проекту.
create or replace function owns_project(pid uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select exists (select 1 from projects where id = pid and owner_id = auth.uid());
$$;

-- Кто имеет право видеть профиль сотрудника: он сам, владелец платформы,
-- владелец проекта, где сотрудник состоит, и коллеги по проекту.
create or replace function can_view_profile(target uuid) returns boolean
language sql security definer stable set search_path = public, pg_temp as $$
  select
    target = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and global_role = 'owner')
    or exists (
      select 1
      from project_members target_member
      join projects p on p.id = target_member.project_id
      where target_member.user_id = target and p.owner_id = auth.uid()
    )
    or exists (
      select 1
      from project_members target_member
      join project_members viewer_member on viewer_member.project_id = target_member.project_id
      where target_member.user_id = target
        and viewer_member.user_id = auth.uid()
        and viewer_member.status = 'active'
    );
$$;

-- Профили: сотрудник видит и правит только себя, владелец — всех.
alter table profiles enable row level security;
create policy profiles_visible on profiles for select using (can_view_profile(id));
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_owner_all on profiles for all using (is_owner()) with check (is_owner());

-- Проекты: владелец платформы и владелец проекта — полный доступ, участник — чтение.
alter table projects enable row level security;
create policy projects_owner on projects for all
  using (owner_id = auth.uid() or is_owner())
  with check (owner_id = auth.uid() or is_owner());
create policy projects_member_read on projects for select using (is_project_member(id));

-- Шаблон для всех таблиц с project_id:
--   владелец платформы и владелец проекта пишут, активный участник читает.
do $$
declare
  tbl text;
  tables text[] := array[
    'project_members','metrics_daily','customers','leads','sales','returns',
    'employee_reports','products','project_sections','access_rights','resources',
    'integrations','creatives','activity_log'
  ];
begin
  foreach tbl in array tables loop
    execute format('alter table %I enable row level security', tbl);
    execute format(
      'create policy %I on %I for all using (is_owner() or owns_project(project_id)) '
      || 'with check (is_owner() or owns_project(project_id))',
      tbl || '_owner', tbl
    );
    execute format(
      'create policy %I on %I for select using (is_project_member(project_id))',
      tbl || '_member_read', tbl
    );
  end loop;
end $$;

-- «Мой отчёт»: сотрудник ведёт свои записи сам и видит только их.
create policy employee_reports_author on employee_reports for all
  using (author_id = auth.uid() and is_project_member(project_id))
  with check (author_id = auth.uid() and is_project_member(project_id));

-- Точечные права записи для менеджера / продажника / РОПа добавляются
-- политиками for insert/for update по мере появления экранов (ТЗ, раздел 9).
