import { loadSchedule, saveSchedule } from "../data/repo.js";
import { Schedule } from "../domain/entities.js";

/**
 * editTaskInSchedule
 *
 * Сценарий: пользователь редактирует задачу в расписании недели.
 *
 * Что меняется:
 *  - название
 *  - минуты
 *  - список offloadDays (разгрузочных дней)
 *
 * Всё это делается через метод Schedule.withEditedTask(...)
 */
export default async function editTaskInSchedule({ weekdayKey, taskId, patch }) {
  // 1. Загружаем текущее расписание
  const rawSchedule = await loadSchedule();
  const schedule = Schedule.fromJSON(rawSchedule);

  // 2. Получаем обновлённое расписание с изменённой задачей
  const updatedSchedule = schedule.withEditedTask(weekdayKey, taskId, patch);

  // 3. Сохраняем обратно
  await saveSchedule(updatedSchedule.toJSON(), "editTaskInSchedule");

  return updatedSchedule;
}