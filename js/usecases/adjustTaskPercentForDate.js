import { loadDayOverride, saveDayOverride, loadSchedule } from "../data/repo.js";
import { DayOverride, Schedule } from "../domain/entities.js";

/**
 * adjustTaskPercentForDate
 *
 * Сценарий: пользователь нажал "+10%" или "-10%" у задачи на конкретный день.
 *
 * Что должно происходить:
 *  1. У нас должен существовать DayOverride для dateKey (снимок задач дня).
 *     Если его ещё нет, мы должны его создать из расписания недели.
 *
 *  2. В этом DayOverride должна существовать задача с данным taskId.
 *     Если нет — мы берём её из Schedule и добавляем (ensureTask).
 *
 *  3. Увеличиваем или уменьшаем прогресс задачи на delta (обычно +10 или -10).
 *     Логика обновления процента и done-флага живёт внутри DayOverride/Task.
 *
 *  4. Сохраняем обратно через repo.
 */
export async function adjustTaskPercentForDate({ dateKey, taskId, delta }) {
  // 1. Загружаем расписание (недельный шаблон) как Schedule.
  const rawSchedule = await loadSchedule();
  const schedule = Schedule.fromJSON(rawSchedule);

  // 2. Загружаем override для этого дня.
  let rawOv = await loadDayOverride(dateKey);
  let overrideEntity;

  if (rawOv) {
    overrideEntity = DayOverride.fromJSON(rawOv);
  } else {
    // если оверрайда нет, создаём на основе расписания
    overrideEntity = schedule.makeOverrideForDate(dateKey);
  }

  // 3. Гарантируем, что задача в этом override вообще существует.
  overrideEntity.ensureTask(taskId, schedule);

  // 4. Меняем прогресс через bumpTaskPercent (это +delta или -delta).
  const updatedTask = overrideEntity.bumpTaskPercent(taskId, delta);

  // 5. Сохраняем новое состояние дня.
  await saveDayOverride(
    overrideEntity.toJSON(),
    "adjustTaskPercentForDate"
  );

  // 6. Возвращаем инфу для мгновенного обновления UI.
  return {
    taskId,
    donePercent: updatedTask?.donePercent ?? 0,
    done: updatedTask?.done ?? false
  };
}

export default adjustTaskPercentForDate;