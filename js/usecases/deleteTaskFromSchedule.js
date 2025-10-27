import { loadSchedule, saveSchedule } from "../data/repo.js";

/**
 * deleteTaskFromSchedule
 *
 * Удаляет задачу из недельного расписания (шаблона),
 * то есть из секции "Расписание недели".
 *
 * Она НЕ трогает уже созданные override-дни в прошлом.
 */
export async function deleteTaskFromSchedule({ weekdayKey, taskId }) {
  const sched = await loadSchedule();

  const arr = Array.isArray(sched[weekdayKey]) ? sched[weekdayKey] : [];
  const filtered = arr.filter(t => String(t.id) !== String(taskId));

  sched[weekdayKey] = filtered;
  await saveSchedule(sched, "deleteTaskFromSchedule");

  return true;
}

export default deleteTaskFromSchedule;