import { loadDayOverride, loadSchedule } from "../data/repo.js";

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

// Клонируем задачу из расписания для override
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
    meta: null
  };
}

export default async function ensureTaskInOverrideForDate({ dateKey, taskId }){
  let ov = await loadDayOverride(dateKey);
  if(!ov){
    ov = await buildFreshOverrideFromSchedule(dateKey);
  }

  if(!Array.isArray(ov.tasks)){
    ov.tasks = [];
  }

  let task = ov.tasks.find(
    t => String(t.id||"") === String(taskId||"")
  );

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

  // Больше не сохраняем ov здесь — пусть сохраняет тот, кто реально меняет задачу
  return { ov, task };
}