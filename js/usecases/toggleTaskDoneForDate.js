// js/usecases/toggleTaskDoneForDate.js
// Переключает чекбокс задачи (0% <-> 100%) для конкретной даты.

import ensureTaskInOverrideForDate from "./ensureTaskInOverrideForDate.js";
import { saveDayOverride } from "../data/repo.js";

export default async function toggleTaskDoneForDate({ dateKey, taskId }){
  const { ov, task } = await ensureTaskInOverrideForDate({ dateKey, taskId });

  const curPct = Math.max(
    0,
    Math.min(100, Math.round(Number(task.donePercent)||0))
  );

  const nextPct = (curPct >= 100) ? 0 : 100;

  task.donePercent = nextPct;
  task.done = nextPct >= 100;

  await saveDayOverride(ov, "toggleDone");
  return ov.tasks;
}
