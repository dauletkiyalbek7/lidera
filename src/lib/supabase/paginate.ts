import "server-only";

/**
 * Постраничное чтение всех строк.
 *
 * PostgREST по умолчанию отдаёт максимум 1000 строк за запрос. Наши разделы
 * складывают суммы из строк в JS (расход, лиды, продажи по креативам), поэтому
 * молчаливая обрезка на 1000 занижает итоги. Здесь тянем страницами по 1000,
 * пока строки не кончатся.
 *
 * Запрос обязательно должен быть с устойчивым порядком (.order), иначе одна и та
 * же строка может попасть на две страницы или потеряться между ними.
 */

const PAGE_SIZE = 1000;

type Page<T> = { data: T[] | null; error: unknown };

export async function fetchAllRows<T>(
  makeQuery: (from: number, to: number) => PromiseLike<Page<T>>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makeQuery(from, from + PAGE_SIZE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return all;
}
