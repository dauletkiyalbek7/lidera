-- Telegram-бот платформы (ТЗ, раздел 7: Настройки → Telegram-бот).
-- Сотрудник отправляет боту свой одноразовый код — и его чат привязывается к учётке.
-- Через эту привязку позже пойдут подтверждения продаж для CAPI и уведомления.

-- Секрет вебхука. Как у приёма заявок и чат-бота — храним только отпечаток.
create table telegram_webhooks (
  project_id       uuid primary key references projects(id) on delete cascade,
  token_hash       text not null unique,
  hint             text,
  received_count   int not null default 0,
  last_received_at timestamptz,
  issued_by        uuid references profiles(id),
  issued_at        timestamptz not null default now()
);

-- RLS включён, политик нет: секрет вебхука не должен быть виден из браузера.
alter table telegram_webhooks enable row level security;

create table telegram_accounts (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  user_id        uuid not null references profiles(id) on delete cascade,
  -- Код живёт до привязки: сотрудник отправляет его боту одним сообщением.
  code           text not null,
  code_issued_at timestamptz not null default now(),
  chat_id        text,
  username       text,
  status         text not null default 'pending' check (status in ('pending','linked')),
  linked_at      timestamptz,
  unique (project_id, user_id),
  unique (project_id, code)
);

create index telegram_accounts_project_idx on telegram_accounts (project_id);

alter table telegram_accounts enable row level security;

create policy telegram_accounts_owner on telegram_accounts for all
  using (is_owner() or owns_project(project_id))
  with check (is_owner() or owns_project(project_id));

create policy telegram_accounts_director on telegram_accounts for all to authenticated
  using (has_project_role(project_id, array['director']))
  with check (has_project_role(project_id, array['director']));

-- Сотрудник видит только свою привязку: чужой код — чужой доступ к боту.
create policy telegram_accounts_self_read on telegram_accounts for select
  using (user_id = auth.uid());
