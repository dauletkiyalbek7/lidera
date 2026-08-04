-- Посещения по геозоне (ТЗ, Блок 5 + процесс продаж: «в офисе → получает лиды»).
--
-- У проекта — координаты офиса и радиус. Сотрудник отмечается о приходе (в боте
-- шарит геолокацию), попадание в радиус ставит «на смене» и отмечает день в табеле.
-- Раньше «на смене» ставили вручную тумблером — он остаётся запасным вариантом.
alter table projects
  add column office_lat      numeric,
  add column office_lng      numeric,
  add column office_radius_m int not null default 150 check (office_radius_m > 0);

-- К дневной отметке табеля — время прихода/ухода и координаты прихода.
alter table attendance
  add column check_in_at  timestamptz,
  add column check_out_at timestamptz,
  add column check_in_lat numeric,
  add column check_in_lng numeric;
