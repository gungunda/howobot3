// js/usecases/ensureTaskInOverrideForDate.js
//
// Задача: убедиться, что в снимке дня (override) для dateKey
// есть задача с нужным taskId.
//
// Если override ещё не существует — мы создаём его из расписания
// (логика "домашки на завтра": берём следующий день и его расписание).
//
// Возвращает { ov, task }:
//   ov   — весь override { dateKey, tasks[], meta }
//   task — конкретная задача внутри ov.tasks

import { loadDayOverride, saveDayOverride, loadSchedule } from "../data/repo.js";

// Добавить N дней к "YYYY-MM-DD"
function addDaysToDateKey(dateKey, days){
  const d = new Date(`${dateKey}T00:00:00`);
  d.setDate(d.getDate() + Number(days||0));
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd= String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

// Получить ключ дня недели из даты
function weekdayKeyFromDateKey(dateKey){
  const d = new Date(`${dateKey}T00:00:00`);
  const map=[
    "sunday","monday","tuesday",
    "wednesday","thursday","friday","saturday"
  ];
  return map[d.getDay()] || "monday";
}

// Клонируем задачу из расписания для override:
// прогресс = 0%, offloadDays = null
function cloneFromScheduleTask(srcTask, fallbackId){
  return {
    id: String(srcTask?.id || fallbackId || ""),
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

// Создать новый override для dateKey, если его нет.
// Мы берём "завтрашний" день и используем расписание того дня недели.
async function buildFreshOverrideFromSchedule(dateKey){
  const schedule = await loadSchedule();

  const nextDateKey = addDaysToDateKey(dateKey, 1);
  const weekdayKey = weekdayKeyFromDateKey(nextDateKey);

  const srcArr = Array.isArray(schedule?.[weekdayKey])
    ? schedule[weekdayKey]
    : [];

  const clonedTasks = srcArr.map(t => cloneFromScheduleTask(t, t?.id));

  return {
    dateKey,
    tasks: clonedTasks,
    meta: null // saveDayOverride потом добавит meta
  };
}

export default async function ensureTaskInOverrideForDate({ dateKey, taskId }){
  // 1. Загружаем override для этой даты (снимок дня)
  let ov = await loadDayOverride(dateKey);

  // 2. Если нет — создаём с нуля
  if(!ov){
    ov = await buildFreshOverrideFromSchedule(dateKey);
  }

  if(!Array.isArray(ov.tasks)){
    ov.tasks = [];
  }

  // 3. Ищем задачу по id
  let task = ov.tasks.find(
    t => String(t.id||"") === String(taskId||"")
  );

  // 4. Если задачи нет — ищем её в расписании недели по id
  if(!task){
    const schedule = await loadSchedule();
    let found = null;

    for(const weekdayKey of Object.keys(schedule||{})){
      const dayArr = Array.isArray(schedule[weekdayKey]) ? schedule[weekdayKey] : [];
      for(const cand of dayArr){
        if(String(cand.id||"") === String(taskId||"")){
          found = cand;
          break;
        }
      }
      if(found) break;
    }

    const newTask = cloneFromScheduleTask(found, taskId);
    ov.tasks.push(newTask);
    task = newTask;
  }

  // 5. Сохраняем override обратно (важно!)
  await saveDayOverride(ov, "ensureTaskInOverrideForDate");

  return { ov, task };
}
