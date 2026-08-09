-- Правила оценки звонков — свои у каждого проекта (ТЗ, Блок 2).
-- Отдел продаж задаёт критерии (что проверяем + вес) и текст скрипта; AI
-- оценивает запись именно по ним. Храним на проекте одним jsonb:
--   { "script": "текст правил", "criteria": [ { "key","label","weight" } ] }
alter table projects add column if not exists call_rubric jsonb;
