-- Индекс был частичным (WHERE external_id is not null), а Postgres не умеет
-- выводить частичный индекс в ON CONFLICT без того же условия. PostgREST его
-- не подставляет — поэтому upsert креативов падал на каждой синхронизации,
-- и настоящие объявления кабинета в базу не попадали.
--
-- Делаем индекс полным. Демо-креативам с пустым external_id это не мешает:
-- в Postgres NULL-ы в уникальном индексе считаются разными.
drop index creatives_external_key;

create unique index creatives_external_key
  on creatives (project_id, platform, external_id);
