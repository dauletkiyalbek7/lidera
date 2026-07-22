/**
 * Логин и пароль сотрудника генерирует платформа (ТЗ, раздел 4).
 * Логин делаем читаемым — по имени, чтобы владелец узнавал его в списке.
 */

const CYRILLIC_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ә: "a", ғ: "g", қ: "k", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
};

/** «Айгерим Сериковна» → «aigerim.serikovna» */
export function slugifyName(fullName: string): string {
  const latin = fullName
    .toLowerCase()
    .split("")
    .map((char) => CYRILLIC_MAP[char] ?? char)
    .join("");

  const slug = latin
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 32);

  return slug || "user";
}

/** Логин уникален внутри проекта: к имени добавляется короткий ключ проекта. */
export function buildLogin(fullName: string, projectId: string, suffix = ""): string {
  return `${slugifyName(fullName)}${suffix}.${projectId.slice(0, 8)}@lidera.team`;
}

// Без похожих символов: 0/O, 1/l/I — их путают, когда диктуют пароль голосом.
const PASSWORD_ALPHABET = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";
const PASSWORD_LENGTH = 12;

export function generatePassword(): string {
  const bytes = new Uint32Array(PASSWORD_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (value) => PASSWORD_ALPHABET[value % PASSWORD_ALPHABET.length]).join("");
}
