// js/usecases/ensureOverrideForDate.js
//
// Гарантирует, что override для данной даты dateKey существует.
// Это нужно, когда нам не важна конкретная задача, а важен
// весь снимок дня целиком.
//
// Если снимка ещё нет — создаём его из расписания ("домашки на завтра").
// Возвращаем сам override { dateKey, tasks[], meta }.

import { loadDayOverride, saveDayOverride, loadSchedule } from "../data/repo.js";

function addDaysToDateKey(dateKey, days){
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + Number(days||0));
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd= String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

function weekdayKeyFromDateKey(dateKey){
  const d = new Date(`${dateKey}T00:00:00`);
  const map=[
    "sunday","monday","tuesday",
    "wednesday","thursday","friday","saturday"
  ];
  return map[d.getDay()] || "monday";
}

function cloneFromScheduleTask(srcTask){
  return {
    id: String(srcTask?.id || ""),
    title: String(srcTask?.title || "Без названия"),
    minutes: Math.max(0, Number(srcTask?.minutes)||0),
    donePercent: 0,
    done: false,
    offloadDays: null,
    meta: (srcTask?.meta && typeof srcTask.meta === "object")
      ? srcTask.meta
      : null
  };
}

async function buildFreshOverrideFromSchedule(dateKey){
  const schedule = await loadSchedule();

  const nextDateKey = addDaysToDateKey(dateKey, 1);
  const weekdayKey  = weekdayKeyFromDateKey(nextDateKey);

  const arr = Array.isArray(schedule?.[weekdayKey])
    ? schedule[weekdayKey]
    : [];

  return {
    dateKey,
    tasks: arr.map(cloneFromScheduleTask),
    meta: null
  };
}

export default async function ensureOverrideForDate(dateKey){
  let ov = await loadDayOverride(dateKey);
  if(!ov){
    ov = await buildFreshOverrideFromSchedule(dateKey);
    await saveDayOverride(ov, "ensureOverrideForDate");
  }
  return ov;
}
