import ensureTaskInOverrideForDate from "./ensureTaskInOverrideForDate.js";
import { saveDayOverride } from "../data/repo.js";

/**
 * adjustTaskPercentForDate
 *
 * Изменяет прогресс задачи (donePercent) на ±10%.
 * Это вызывается когда пользователь жмёт кнопки "-10%" или "+10%" в дашборде.
 *
 * ВАЖНО:
 * - Мы не трогаем глобальное расписание недели.
 * - Мы работаем только с override для конкретной даты.
 * - Если override не существовал, он создаётся (только сейчас,
 *   то есть при реальном редактировании, что нам и нужно).
 */
export async function adjustTaskPercentForDate({ dateKey, taskId, delta }) {
  // убеждаемся, что в override дня есть эта задача
  const { ov, task } = await ensureTaskInOverrideForDate(dateKey, taskId);

  // скорректировать donePercent
  const newPctRaw = Number(task.donePercent || 0) + Number(delta || 0);
  let newPct = Math.round(newPctRaw);
  if (newPct < 0) newPct = 0;
  if (newPct > 100) newPct = 100;

  task.donePercent = newPct;
  task.done = newPct >= 100;

  // пересобрать список задач (заменяем задачу с тем же id)
  ov.tasks = ov.tasks.map(t => {
    if (String(t.id) === String(taskId)) {
      return { ...t, donePercent: task.donePercent, done: task.done };
    }
    return t;
  });

  await saveDayOverride(ov, "adjustTaskPercentForDate");
  return { taskId, donePercent: task.donePercent };
}

export default adjustTaskPercentForDate;