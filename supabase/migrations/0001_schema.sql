-- Lidera — схема базы данных (ТЗ, раздел 8).
-- Все таблицы данных несут project_id: это основа multi-tenant изоляции.

-- Профили (расширяют auth.users). Любой, у кого есть логин.
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  global_role text not null default 'director'
                check (global_role in ('owner','director','rop','manager','salesperson')),
  created_at  timestamptz not null default now()
);

-- Проекты
create table if not exists projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references profiles(id),
  name          text not null,
  niche         text not null check (niche in ('education','ecommerce')),
  director_name text,
  description   text,
  status        text not null default 'active' check (status in ('active','paused','completed')),
  plan          text not null default 'trial'  check (plan in ('free','trial','pro')),
  -- Валюта проекта (ТЗ, раздел 12: тенге по умолчанию, настраивается на уровне проекта)
  currency      text not null default 'KZT',
  icon          text,
  accent_color  text,
  created_at    timestamptz not null default now()
);
create index if not exists projects_owner_idx on projects (owner_id);

-- Участники проекта (доступ: кто и с какой ролью внутри проекта)
create table if not exists project_members (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       text not null check (role in ('director','rop','manager','salesperson')),
  status     text not null default 'active' check (status in ('active','fired')),
  hired_at   timestamptz not null default now(),
  fired_at   timestamptz,
  unique (project_id, user_id)
);
create index if not exists project_members_user_idx on project_members (user_id);

-- Агрегированные метрики по дням (источник цифр для дашбордов)
create table if not exists metrics_daily (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  date           date not null,
  leads          int not null default 0,
  qualified      int not null default 0,   -- обработанные/качественные
  trial_lessons  int not null default 0,   -- education
  sales          int not null default 0,
  revenue        numeric not null default 0,
  ad_spend       numeric not null default 0,
  unique (project_id, date)
);
create index if not exists metrics_daily_project_date_idx on metrics_daily (project_id, date);

-- Клиенты (купившие; один клиент может иметь несколько продаж)
create table if not exists customers (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  full_name         text not null,
  phone             text,
  first_purchase_at timestamptz,
  total_spent       numeric not null default 0,  -- LTV
  created_at        timestamptz not null default now()
);
create index if not exists customers_project_idx on customers (project_id);

-- Лиды (CRM)
create table if not exists leads (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  full_name   text not null,
  phone       text,
  source      text,      -- 'meta' | 'tiktok' | 'whatsapp' | 'other'
  status      text not null default 'new',  -- education: new|qualified|trial_booked|trial_done|sale; ecommerce: new|processed|sale
  assigned_to uuid references profiles(id),
  value       numeric default 0,
  created_at  timestamptz not null default now()
);
create index if not exists leads_project_created_idx on leads (project_id, created_at);

-- Продажи
create table if not exists sales (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  lead_id      uuid references leads(id),
  customer_id  uuid references customers(id),
  seller_id    uuid references profiles(id),   -- продажник, закрывший продажу
  product      text,
  amount       numeric not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists sales_project_created_idx on sales (project_id, created_at);

-- Возвраты
create table if not exists returns (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects(id) on delete cascade,
  sale_id      uuid references sales(id),
  amount       numeric not null default 0,
  reason       text,
  processed_by uuid references profiles(id),    -- РОП или директор
  created_at   timestamptz not null default now()
);
create index if not exists returns_project_idx on returns (project_id);

-- Личные отчёты сотрудников («Мой отчёт» / РМП)
create table if not exists employee_reports (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  author_id   uuid not null references profiles(id),
  report_date date not null,
  content     jsonb,     -- заполняемые поля отчёта
  created_at  timestamptz not null default now()
);
create index if not exists employee_reports_project_author_idx on employee_reports (project_id, author_id);

-- Товары / склад (только ecommerce)
create table if not exists products (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  name           text not null,
  sku            text,
  stock_quantity int not null default 0,
  cost_price     numeric not null default 0,
  sale_price     numeric not null default 0,
  low_stock_threshold int not null default 5,
  created_at     timestamptz not null default now()
);
create index if not exists products_project_idx on products (project_id);

-- Разделы, включённые на проекте (тумблеры в настройках)
create table if not exists project_sections (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  section_key text not null,           -- 'leads' | 'sales' | 'ads' | ...
  enabled     boolean not null default true,
  unique (project_id, section_key)
);

-- Права доступа: роль/сотрудник → раздел
create table if not exists access_rights (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  role        text,                    -- права по роли …
  user_id     uuid references profiles(id),  -- … или точечно по сотруднику
  section_key text not null,
  can_view    boolean not null default false,
  can_edit    boolean not null default false
);
create index if not exists access_rights_project_idx on access_rights (project_id);

-- Ресурсы (WhatsApp-номера, сайты/лендинги, Tilda)
create table if not exists resources (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type       text not null check (type in ('whatsapp','site','tilda','other')),
  label      text,
  value      text,                     -- номер или URL
  created_at timestamptz not null default now()
);
create index if not exists resources_project_idx on resources (project_id);

-- Интеграции (Meta, TikTok, ChatPlace, Telegram, AI-сервисы) — статус подключения
create table if not exists integrations (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  provider   text not null,            -- 'meta' | 'tiktok' | 'chatplace' | 'telegram' | 'ai'
  status     text not null default 'disconnected',
  config     jsonb,                    -- секреты НЕ хранить открыто; токены отдельно, зашифрованно
  created_at timestamptz not null default now()
);
create index if not exists integrations_project_idx on integrations (project_id);

-- Креативы (для сквозной аналитики; позже связать leads.creative_id и sales.creative_id)
create table if not exists creatives (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  name        text not null,
  platform    text,                    -- 'meta' | 'tiktok'
  external_id text,
  created_at  timestamptz not null default now()
);
create index if not exists creatives_project_idx on creatives (project_id);

-- Журнал действий
create table if not exists activity_log (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  actor_id   uuid references profiles(id),
  action     text not null,            -- 'project.created' | 'member.fired' | 'return.created' | ...
  details    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_project_created_idx on activity_log (project_id, created_at);
