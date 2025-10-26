// js/usecases/adjustTaskPercentForDate.js
// Изменить прогресс задачи (±delta %) для конкретной даты.
// Если задачи нет в override, сначала добавим её туда.

import ensureTaskInOverrideForDate from "./ensureTaskInOverrideForDate.js";
import { saveDayOverride } from "../data/repo.js";

export default async function adjustTaskPercentForDate({ dateKey, taskId, delta = 0 }){
  const { ov, task } = await ensureTaskInOverrideForDate({ dateKey, taskId });

  const cur = Math.max(0, Math.min(100, Math.round(Number(task.donePercent)||0)));
  const next = Math.max(
    0,
    Math.min(100, Math.round(cur + (Number(delta)||0)))
  );

  task.donePercent = next;
  task.done = next >= 100;

  await saveDayOverride(ov, "progress++");
  return ov.tasks;
}
