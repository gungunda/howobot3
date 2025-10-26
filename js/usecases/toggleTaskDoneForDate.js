// js/usecases/toggleTaskDoneForDate.js
// Переключить чекбокс задачи (0% <-> 100%) для дня.

import ensureTaskInOverrideForDate from "./ensureTaskInOverrideForDate.js";
import { saveDayOverride } from "../data/repo.js";

export default async function toggleTaskDoneForDate({ dateKey, taskId }){
  const { ov, task } = await ensureTaskInOverrideForDate({ dateKey, taskId });

  const cur = Math.max(0, Math.min(100, Math.round(Number(task.donePercent)||0)));
  const next = (cur >= 100) ? 0 : 100;

  task.donePercent = next;
  task.done = next >= 100;

  await saveDayOverride(ov, "toggleDone");
  return ov.tasks;
}
