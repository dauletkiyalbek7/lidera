-- Продажа курса и чек (ТЗ, Блок 2 + раздел 7: CAPI/подтверждение чеком).
--
-- Продажник закрывает продажу курса на сайте, затем пересылает боту чек клиента —
-- бот привязывает его к продаже и подтверждает. Автопроверку суммы и CAPI сделаем
-- позже; пока храним факт чека (файл в Telegram) и статус.
alter table sales
  add column receipt_status  text not null default 'awaiting'
    check (receipt_status in ('awaiting','confirmed')),
  add column receipt_file_id text,          -- file_id чека в Telegram
  add column receipt_at       timestamptz;  -- когда чек подтверждён

-- Настоящая продажа должна попадать в дашборд: он читает цифры из metrics_daily
-- (demo → real без переписывания UI, ТЗ раздел 3). Атомарно копим день, чтобы две
-- продажи в один день не затёрли друг друга.
create or replace function public.record_daily_sale(p_project uuid, p_date date, p_amount numeric)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.metrics_daily (project_id, date, sales, revenue)
  values (p_project, p_date, 1, p_amount)
  on conflict (project_id, date)
  do update set sales   = public.metrics_daily.sales + 1,
                revenue = public.metrics_daily.revenue + excluded.revenue;
$$;
