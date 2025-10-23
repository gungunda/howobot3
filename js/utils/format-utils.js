// js/utils/format-utils.js
// ✅ Набор именованных экспортов. Важно: minutesToStr — именно именованный экспорт.
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const clampPct = (p) => clamp(Math.round(Number(p) || 0), 0, 100);
export const sum = (arr) => arr.reduce((a, b) => a + (Number(b) || 0), 0);

export function minutesToStr(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(m / 60), mm = m % 60;
  if (h > 0) return `${h} ч ${mm} мин`;
  return `${mm} мин`;
}
