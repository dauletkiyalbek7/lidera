/** Склейка классов: отбрасывает пустые и условные значения. */
export function cn(...values: (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}
