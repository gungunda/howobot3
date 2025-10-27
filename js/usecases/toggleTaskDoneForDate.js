import ensureTaskInOverrideForDate from "./ensureTaskInOverrideForDate.js";
import { saveDayOverride } from "../data/repo.js";

/**
 * toggleTaskDoneForDate
 *
 * Меняет состояние чекбокса "сделано" у конкретной задачи в конкретную дату.
 *
 * Логика:
 * - если задача <100% → ставим 100% и done=true
 * - если задача уже 100% → сбрасываем в 0% и done=false
 *
 * Это работает ТОЛЬКО на override дня:
 * мы не трогаем недельное расписание.
 */
export default async function toggleTaskDoneForDate({ dateKey, taskId }) {
  const { ov, task } = await ensureTaskInOverrideForDate(dateKey, taskId);

  const wasDone = task.donePercent >= 100;
  const newPct = wasDone ? 0 : 100;

  task.donePercent = newPct;
  task.done = newPct >= 100;

  ov.tasks = ov.tasks.map(t => {
    if (String(t.id) === String(taskId)) {
      return {
        ...t,
        donePercent: task.donePercent,
        done: task.done
      };
    }
    return t;
  });

  ov.meta = {
    ...ov.meta,
    updatedAt: new Date().toISOString(),
    userAction: "toggleTaskDoneForDate"
  };

  await saveDayOverride(ov, "toggleTaskDoneForDate");
  return { taskId, donePercent: task.donePercent, done: task.done };
}