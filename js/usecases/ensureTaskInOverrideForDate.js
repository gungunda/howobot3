// js/usecases/ensureTaskInOverrideForDate.js
// Гарантирует, что в override дня dateKey существует задача taskId.
// Если override ещё не создан — создаём через ensureOverrideForDate().
// Если задачи нет внутри дня — ищем её в недельном расписании по id
// и добавляем с прогрессом 0.
// Возвращаем { ov, task }.

import ensureOverrideForDate from "./ensureOverrideForDate.js";
import { loadSchedule, saveDayOverride } from "../data/repo.js";

function normBaseTask(src, taskId){
  return {
    id: String((src && src.id) || taskId || ""),
    title: String(src && src.title ? src.title : "Без названия"),
    minutes: Math.max(0, Number(src && src.minutes || 0) || 0),
    donePercent: 0,
    done: false,
    offloadDays: null,
    meta: src && src.meta && typeof src.meta==="object" ? src.meta : null
  };
}

export default async function ensureTaskInOverrideForDate({ dateKey, taskId }){
  // 1. гарантируем день
  const ov = await ensureOverrideForDate(dateKey);
  if (!Array.isArray(ov.tasks)) ov.tasks = [];

  // 2. ищем задачу в самом дне
  let task = ov.tasks.find(x => String(x.id||"") === String(taskId||""));
  if (task) {
    return { ov, task };
  }

  // 3. ищем задачу в недельном расписании
  const schedule = await loadSchedule();
  let found = null;
  for (const weekdayKey of Object.keys(schedule||{})){
    const dayArr = Array.isArray(schedule[weekdayKey]) ? schedule[weekdayKey] : [];
    for (const cand of dayArr){
      if (String(cand.id||"") === String(taskId||"")){
        found = cand;
        break;
      }
    }
    if (found) break;
  }

  // 4. добавляем новую задачу в день
  task = normBaseTask(found, taskId);
  ov.tasks.push(task);

  await saveDayOverride(ov, "ensureTaskInOverrideForDate");
  return { ov, task };
}
