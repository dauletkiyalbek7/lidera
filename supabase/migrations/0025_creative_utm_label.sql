-- UTM-метка креатива: стабильное имя, которое владелец задаёт сам и ставит в
-- ссылку объявления как utm_content. По ней intake находит креатив с сайта.
-- Синхронизация Meta её не трогает (upsert перечисляет только свои колонки),
-- поэтому имя из кабинета её не перезапишет.
alter table creatives add column if not exists utm_label text;

-- Ищем по метке без учёта регистра и пробелов — так владельцу не нужно точь-в-точь.
create unique index if not exists creatives_utm_label_uidx
  on creatives (project_id, lower(btrim(utm_label)))
  where utm_label is not null and btrim(utm_label) <> '';
