import { loadDayOverride, loadSchedule, saveDayOverride } from "../data/repo.js";
import { DayOverride, Schedule } from "../domain/entities.js";

/**
 * forceCreateOverrideFromSchedule
 *
 * Это "жёсткий" сценарий.
 * Он нужен, когда пользователь специально сказал:
 *   "Сбросить день"
 *
 * Что он делает:
 *   - Берёт актуальное расписание (Schedule)
 *   - Строит новый DayOverride на dateKey, исходя из правила
 *     "домашка на завтра"
 *   - Сразу сохраняет этот DayOverride в хранилище, затирая старое
 *
 * Это намеренное действие пользователя, поэтому да,
 * мы имеем право перезаписать override.
 *
 * Важно отличие от обычного просмотра:
 *   при просто просмотре дня override не создаётся автоматически.
 */
export default async function forceCreateOverrideFromSchedule(dateKey) {
  // 1. Загружаем расписание недели как Schedule
  const rawSchedule = await loadSchedule();
  const schedule = Schedule.fromJSON(rawSchedule);

  // 2. Проверим, может override уже есть
  let rawOv = await loadDayOverride(dateKey);
  let overrideEntity;

  if (rawOv) {
    // Если override уже есть — в контексте "жёсткого сброса"
    // мы всё равно хотим его обновить полностью:
    // т.е. пересоздать на основе расписания.
    //
    // То есть мы НЕ просто возвращаем старый ov,
    // а именно перезаписываем задачами "на завтра".
    overrideEntity = schedule.makeOverrideForDate(dateKey);
    overrideEntity.meta.userAction = "forceCreateOverrideFromSchedule(resetExisting)";
  } else {
    // Если override не было, просто создаём новый
    overrideEntity = schedule.makeOverrideForDate(dateKey);
    overrideEntity.meta.userAction = "forceCreateOverrideFromSchedule(new)";
  }

  // 3. Сохраняем новое состояние дня
  await saveDayOverride(
    overrideEntity.toJSON(),
    "forceCreateOverrideFromSchedule"
  );

  // 4. Возвращаем сущность (или plain можно отдать, но сущность удобнее тестировать)
  return overrideEntity;
}