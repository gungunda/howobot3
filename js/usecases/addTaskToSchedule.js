// js/usecases/addTaskToSchedule.js
// Добавить новую задачу в недельное расписание (в конкретный weekday).
import { loadSchedule, saveSchedule } from "../data/repo.js";

export default async function addTaskToSchedule({ weekdayKey, task }){
  const sched = await loadSchedule();
  if (!Array.isArray(sched[weekdayKey])) sched[weekdayKey] = [];
  sched[weekdayKey].push({
    id: String(task.id || crypto.randomUUID?.() || Date.now()+""),
    title: String(task.title || "Без названия"),
    minutes: Math.max(0, Number(task.minutes)||0),
    offloadDays: Array.isArray(task.offloadDays) ? [...task.offloadDays] : []
  });
  await saveSchedule(sched, "addTaskToSchedule");
  return sched;
}
