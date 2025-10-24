// js/usecases/addTaskToSchedule.js
// Добавляет новую задачу в расписание конкретного дня недели.
// Вызывается из view-week.js по кнопке "+".
//
// Новая задача:
//   { id, title, minutes, offloadDays: [] }
//
// Мы генерируем id локально (без зависимостей от app.js / id.js),
// чтобы не было ошибок импорта.

import { loadSchedule, saveSchedule } from "../adapters/smart/smart.schedule.repo.js";

// простой генератор id. Нам не нужно что-то криптостойкое, просто чтобы не было коллизий.
function generateId() {
  return "t_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,7);
}

export default async function addTaskToSchedule({ weekday, task }) {
  const schedule = await loadSchedule();

  const newTask = {
    id: generateId(),
    title: String(task.title || "Новая задача"),
    minutes: Math.max(0, Number(task.minutes) || 0),
    offloadDays: Array.isArray(task.offloadDays) ? [...task.offloadDays] : []
  };

  const dayArr = Array.isArray(schedule[weekday]) ? schedule[weekday] : [];
  schedule[weekday] = [...dayArr, newTask];

  await saveSchedule(schedule);

  return schedule;
}
