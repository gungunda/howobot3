import { loadSchedule, saveSchedule } from "../data/repo.js";
import { Schedule } from "../domain/entities.js";

/**
 * deleteTaskFromSchedule
 *
 * Сценарий: пользователь удаляет задачу из расписания недели.
 *
 * Логика:
 *  1. Загружаем расписание
 *  2. Вызываем Schedule.withTaskRemoved(weekdayKey, taskId)
 *  3. Сохраняем обратно
 */
export default async function deleteTaskFromSchedule({ weekdayKey, taskId }) {
  const rawSchedule = await loadSchedule();
  const schedule = Schedule.fromJSON(rawSchedule);

  const updatedSchedule = schedule.withTaskRemoved(weekdayKey, taskId);

  await saveSchedule(updatedSchedule.toJSON(), "deleteTaskFromSchedule");

  return updatedSchedule;
}