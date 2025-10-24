// js/usecases/ensureTaskInOverrideForDate.js
// Гарантирует, что в override на конкретную дату (dateKey)
// есть задача с данным taskId.
// Если override не существует — создаём снапшот дня через ensureOverrideForDate.
// Если задачи ещё нет в ov.tasks — ищем её в расписании недели
// и копируем туда с прогрессом 0.
//
// ВАЖНО: В override поле offloadDays всегда должно быть null.
// В расписании недели offloadDays — это массив разгрузочных дней.
// Но в "снимке дня" (override) задача уже конкретная, её не надо
// ещё куда-то выносить, поэтому offloadDays:null.
//
// Возвращает { ov, task }.

import ensureOverrideForDate from "./ensureOverrideForDate.js";

function normBaseTask(t, taskId){
  return {
    id: String((t && t.id) || taskId || ""),
    title: String(t && t.title ? t.title : "Без названия"),
    minutes: Math.max(0, Number(t && t.minutes || 0) || 0),
    donePercent: 0,
    done: false,
    offloadDays: null // В override всегда null по новой доменной модели
  };
}

export default async function ensureTaskInOverrideForDate({ dateKey, taskId }){
  const ovRepo = await import("../adapters/smart/smart.override.repo.js");
  const schRepo= await import("../adapters/smart/smart.schedule.repo.js");

  const saveOv = ovRepo.saveOverride || ovRepo.save;
  const loadS  = schRepo.loadSchedule || schRepo.load;

  // 1. гарантируем override на дату
  const ov = await ensureOverrideForDate(dateKey);
  if(!Array.isArray(ov.tasks)) ov.tasks = [];

  // 2. ищем задачу в override
  let t = ov.tasks.find(x => String(x.id||"") === String(taskId||""));
  if(t){
    return { ov, task: t };
  }

  // 3. если нет — ищем её в расписании недели по id
  const schedule = await loadS();
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

  // 4. создаём новую задачу в ov.tasks
  t = normBaseTask(found, taskId);
  ov.tasks.push(t);

  await saveOv(ov);

  return { ov, task: t };
}
