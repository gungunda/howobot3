"use strict";

/** Утилиты форматирования для UI. Пока базовые заглушки. */
export function fmtMinutesLong(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h} ч ${m} мин` : `${m} мин`;
}
