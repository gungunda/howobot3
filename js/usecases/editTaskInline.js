import { loadDayOverride, saveDayOverride, loadSchedule } from "../data/repo.js";
import { DayOverride, Schedule } from "../domain/entities.js";

/**
 * editTaskInline
 *
 * Сценарий: пользователь нажал ✎ на дашборде и меняет
 * название задачи и/или количество минут — НО ТОЛЬКО для конкретного дня.
 *
 * Это НЕ меняет расписание недели, то есть не затрагивает будущее.
 * Это меняет только snapshot дня (DayOverride).
 *
 * Логика:
 *  1. Берём Schedule, чтобы мочь подтащить задачу по taskId,
 *     если её вдруг не было в override.
 *
 *  2. Загружаем (или создаём) DayOverride для dateKey.
 *
 *  3. Через DayOverride.ensureTask(...) убеждаемся, что задача есть.
 *
 *  4. Через DayOverride.editTaskInline(...) меняем title/minutes.
 *
 *  5. Сохраняем всё обратно через saveDayOverride().
 */
export async function editTaskInline({ dateKey, taskId, patch }) {
  // 1. Берём расписание недели как доменную сущность.
  const rawSchedule = await loadSchedule();
  const schedule = Schedule.fromJSON(rawSchedule);

  // 2. Загружаем override дня.
  let rawOv = await loadDayOverride(dateKey);
  let overrideEntity;

  if (rawOv) {
    overrideEntity = DayOverride.fromJSON(rawOv);
  } else {
    // если его ещё не существовало, создаём с нуля на основе расписания
    overrideEntity = schedule.makeOverrideForDate(dateKey);
  }

  // 3. Убеждаемся, что эта задача есть в override
  overrideEntity.ensureTask(taskId, schedule);

  // 4. Правим название / минуты именно в этом дне
  const updatedTask = overrideEntity.editTaskInline(taskId, patch);

  // 5. Сохраняем override обратно
  await saveDayOverride(
    overrideEntity.toJSON(),
    "editTaskInline"
  );

  return {
    taskId,
    title: updatedTask?.title ?? "",
    minutes: updatedTask?.minutes ?? 0
  };
}

export default editTaskInline;