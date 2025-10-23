"use strict";

/** Утилиты работы с датами (заглушка). */
export function addDays(date, n) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}
