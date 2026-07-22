-- Финансы и HR (ТЗ, Блок 5): посещаемость, график работы, правила зарплаты, договоры.

-- Посещаемость: один день — одна отметка на сотрудника.
create table attendance (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  date       date not null,
  status     text not null default 'present'
               check (status in ('present','late','absent','dayoff','sick','vacation')),
  note       text,
  marked_by  uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (project_id, user_id, date)
);

create index attendance_project_date_idx on attendance (project_id, date);

-- График работы: повторяющаяся неделя. weekday 1 — понедельник, 7 — воскресенье.
create table work_shifts (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  weekday    int  not null check (weekday between 1 and 7),
  starts_at  time,
  ends_at    time,
  is_dayoff  boolean not null default false,
  unique (project_id, user_id, weekday)
);

-- Правила зарплаты: оклад плюс проценты и бонусы за результат.
-- Правило задаётся на роль (user_id пуст) либо точечно на сотрудника — он перебивает роль.
create table salary_rules (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects(id) on delete cascade,
  role               text,
  user_id            uuid references profiles(id) on delete cascade,
  base_salary        numeric not null default 0,  -- оклад за полный месяц
  percent_of_sales   numeric not null default 0,  -- % от закрытых продаж за вычетом возвратов
  per_trial          numeric not null default 0,  -- за записанный пробный урок
  per_qualified_lead numeric not null default 0,  -- за квалифицированный лид
  created_at         timestamptz not null default now(),
  -- Либо правило роли, либо правило человека — но не пустое и не то и другое сразу.
  check ((role is null) <> (user_id is null))
);

create unique index salary_rules_role_key on salary_rules (project_id, role)
  where user_id is null;
create unique index salary_rules_user_key on salary_rules (project_id, user_id)
  where user_id is not null;

-- Договоры: карточка без файлов — номер, стороны, сроки, сумма, статус.
create table contracts (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  number       text,
  title        text not null,
  kind         text not null default 'employee'
                 check (kind in ('employee','customer','supplier','other')),
  counterparty text,
  user_id      uuid references profiles(id) on delete set null,
  amount       numeric not null default 0,
  starts_on    date,
  ends_on      date,
  status       text not null default 'active'
                 check (status in ('draft','active','expired','terminated')),
  note         text,
  created_at   timestamptz not null default now()
);

create index contracts_project_idx on contracts (project_id, status);

-- RLS: владелец платформы и владелец проекта — полный доступ, участник — чтение.
do $$
declare
  tbl text;
  tables text[] := array['attendance','work_shifts','salary_rules','contracts'];
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

-- Директор ведёт весь HR-блок; посещаемость отмечает ещё и РОП — он следит за отделом.
create policy attendance_manage on attendance for all to authenticated
  using (has_project_role(project_id, array['director','rop']))
  with check (has_project_role(project_id, array['director','rop']));

create policy work_shifts_manage on work_shifts for all to authenticated
  using (has_project_role(project_id, array['director','rop']))
  with check (has_project_role(project_id, array['director','rop']));

create policy salary_rules_manage on salary_rules for all to authenticated
  using (has_project_role(project_id, array['director']))
  with check (has_project_role(project_id, array['director']));

create policy contracts_manage on contracts for all to authenticated
  using (has_project_role(project_id, array['director']))
  with check (has_project_role(project_id, array['director']));
