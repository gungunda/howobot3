import { loadDayOverride, saveDayOverride, loadSchedule } from "../data/repo.js";
import { DayOverride, Schedule } from "../domain/entities.js";

/**
 * toggleTaskDoneForDate
 *
 * Сценарий: пользователь кликнул чекбокс "сделано" у задачи за конкретный день.
 *
 * Что должно произойти по бизнес-логике:
 *  - для выбранного дня (dateKey) у нас должен быть DayOverride
 *    (снимок задач на этот день).
 *    Если его ещё нет, мы должны его построить на основе расписания.
 *
 *  - в этом DayOverride должна быть нужная задача (taskId).
 *    Если вдруг этой задачи нет в override, мы пробуем вытащить её
 *    из расписания (Schedule) и добавить.
 *
 *  - мы переключаем статус задачи:
 *      если было <100%, становится 100%;
 *      если было 100%, становится 0%;
 *
 *  - сохраняем override обратно через repo.
 *
 * Важно:
 * Раньше эту логику мы собирали вручную прямо здесь.
 * Теперь мы перекладываем поведение в сущности домена:
 *  - Schedule отвечает за знания "что вообще задано"
 *  - DayOverride отвечает за "что сегодня реально делаем и как идёт прогресс"
 *
 * Это соответствует идее Clean Architecture:
 * usecase = orchestration,
 * entities = поведение.
 */

export default async function toggleTaskDoneForDate({ dateKey, taskId }) {
  // 1. Загружаем текущее расписание недели как доменную сущность Schedule.
  const rawSchedule = await loadSchedule();
  const schedule = Schedule.fromJSON(rawSchedule);

  // 2. Загружаем override дня (снимок задач дня) из repo.
  let rawOv = await loadDayOverride(dateKey);

  let overrideEntity;

  if (rawOv) {
    // Уже есть override в хранилище → превращаем его в DayOverride сущность.
    overrideEntity = DayOverride.fromJSON(rawOv);
  } else {
    // Override ещё нет → строим его из расписания.
    //
    // Это та же логика, что раньше была в forceCreateOverrideFromSchedule:
    // "на день D берём домашку на завтра".
    //
    // Теперь это делает Schedule.makeOverrideForDate(dateKey),
    // и мы получаем полноценный DayOverride экземпляр.
    overrideEntity = schedule.makeOverrideForDate(dateKey);
  }

  // 3. Убеждаемся, что в override есть нужная задача.
  //    Если задачи нет, DayOverride сам достанет её из Schedule.
  overrideEntity.ensureTask(taskId, schedule);

  // 4. Переключаем состояние "сделано / не сделано".
  overrideEntity.toggleTaskDone(taskId);

  // 5. Сохраняем обратно через repo.
  //    В repo и Storage должны уходить plain-объекты, без методов класса,
  //    поэтому мы вызываем toJSON().
  await saveDayOverride(overrideEntity.toJSON(), "toggleTaskDoneForDate");

  // 6. Возвращаем наружу полезную информацию,
  //    чтобы UI мог мгновенно обновить DOM без полного рефреша.
  const updatedTask = overrideEntity.getTask(taskId);

  return {
    taskId: taskId,
    donePercent: updatedTask?.donePercent ?? 0,
    done: updatedTask?.done ?? false
  };
}