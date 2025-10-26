// js/usecases/ensureOverrideForDate.js
// Создаёт (если нужно) и возвращает override-день на указанную дату.
// Логика:
// 1. Пытаемся загрузить готовый снапшот дня из хранилища.
// 2. Если day уже есть и там есть задачи — возвращаем.
// 3. Если нет — берём расписание недели, копируем задачи
//    следующего календарного дня недели, обнуляем прогресс,
//    сохраняем как новый override для нужной даты.

import { loadDayOverride, saveDayOverride, loadSchedule } from "../data/repo.js";

function addDaysToDateKey(dateKey, days) {
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + Number(days||0));
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd= String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

function weekdayKeyFromDateKey(dateKey){
  const d = new Date(`${dateKey}T00:00:00`);
  const map=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return map[d.getDay()] || 'monday';
}

function normTaskFromSchedule(t){
  return {
    id: String(t.id||""),
    title: String(t.title||""),
    minutes: Math.max(0, Number(t.minutes)||0),
    donePercent: 0,
    done: false,
    offloadDays: null,
    meta: t.meta && typeof t.meta==="object" ? t.meta : null
  };
}

export default async function ensureOverrideForDate(dateKey){
  // 1. пробуем загрузить уже существующий день
  let ov = await loadDayOverride(dateKey);
  if (ov && Array.isArray(ov.tasks) && ov.tasks.length) {
    return ov;
  }

  // 2. создаём новый день из расписания
  const nextDateKey = addDaysToDateKey(dateKey, 1);
  const wd = weekdayKeyFromDateKey(nextDateKey);

  const schedule = await loadSchedule();
  const srcArr = Array.isArray(schedule?.[wd]) ? schedule[wd] : [];

  ov = {
    dateKey,
    tasks: srcArr.map(normTaskFromSchedule)
  };

  await saveDayOverride(ov, "ensureOverrideForDate");
  return ov;
}
