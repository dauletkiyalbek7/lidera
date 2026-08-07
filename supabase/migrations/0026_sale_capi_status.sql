-- Отправка события покупки в рекламный кабинет (CAPI, ТЗ Блок 3).
-- Статус фиксируем на продаже: подтверждён чек ботом → шлём Purchase в Meta.
--   pending  — ещё не отправляли (чек не подтверждён);
--   sent     — Meta приняла событие;
--   failed   — попытка была, но не прошла (сеть/ошибка API) — можно повторить;
--   skipped  — слать нечего (нет подключения Meta, Pixel ID или телефона).
alter table sales
  add column if not exists capi_status text not null default 'pending'
    check (capi_status in ('pending','sent','failed','skipped')),
  add column if not exists capi_at timestamptz;
