// js/usecases/adjustTaskPercentForDate.js
// Плюс/минус 10% прогресса задачи на конкретный день.

import ensureTaskInOverrideForDate from "./ensureTaskInOverrideForDate.js";
import { saveDayOverride } from "../data/repo.js";

export default async function adjustTaskPercentForDate({
  dateKey,
  taskId,
  delta = 0
}){
  const { ov, task } = await ensureTaskInOverrideForDate({ dateKey, taskId });

  const cur = Math.max(
    0,
    Math.min(100, Math.round(Number(task.donePercent)||0))
  );

  task.donePercent = Math.max(
    0,
    Math.min(100, Math.round(cur + (Number(delta)||0)))
  );

  task.done = task.donePercent >= 100;

  await saveDayOverride(ov, "adjustPercent");
  return ov.tasks;
}
