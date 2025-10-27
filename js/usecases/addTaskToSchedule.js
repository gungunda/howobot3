import { loadSchedule, saveSchedule } from "../data/repo.js";
import { Schedule } from "../domain/entities.js";

/**
 * addTaskToSchedule
 *
 * Сценарий: пользователь добавляет новую задачу в расписание недели.
 *
 * Что происходит:
 *  1. Загружаем расписание (Schedule.fromJSON(...))
 *  2. Добавляем новую задачу в выбранный день недели
 *     через Schedule.withNewTask(weekdayKey, taskData)
 *  3. Сохраняем расписание обратно
 *
 * Пример taskData:
 * {
 *   title: "Математика, упр. 7",
 *   minutes: 30,
 *   offloadDays: ["tuesday", "thursday"]
 * }
 */
export default async function addTaskToSchedule({ weekdayKey, taskData }) {
  // 1. Загружаем текущее расписание
  const rawSchedule = await loadSchedule();
  const schedule = Schedule.fromJSON(rawSchedule);

  // 2. Добавляем новую задачу
  const updatedSchedule = schedule.withNewTask(weekdayKey, taskData);

  // 3. Сохраняем обратно
  await saveSchedule(updatedSchedule.toJSON(), "addTaskToSchedule");

  // 4. Возвращаем свежую копию расписания (для UI)
  return updatedSchedule;
}