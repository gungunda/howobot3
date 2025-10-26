// js/usecases/deleteTaskFromSchedule.js
// Удалить задачу из недельного расписания.
import { loadSchedule, saveSchedule } from "../data/repo.js";

export default async function deleteTaskFromSchedule({ weekdayKey, taskId }){
  const sched = await loadSchedule();
  const arr = Array.isArray(sched[weekdayKey]) ? sched[weekdayKey] : [];
  const filtered = arr.filter(t => String(t.id||"") !== String(taskId||""));
  sched[weekdayKey] = filtered;
  await saveSchedule(sched, "deleteTaskFromSchedule");
  return sched;
}
