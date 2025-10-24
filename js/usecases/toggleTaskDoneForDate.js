// js/usecases/toggleTaskDoneForDate.js
// Переключить чекбокс задачи (0% <-> 100%) для дня.
// Тоже учитывает задачи из блока "Разгрузка".

import ensureTaskInOverrideForDate from "./ensureTaskInOverrideForDate.js";

export default async function toggleTaskDoneForDate({ dateKey, taskId }){
  const ovRepo = await import("../adapters/smart/smart.override.repo.js");
  const saveOv = ovRepo.saveOverride || ovRepo.save;

  const { ov, task } = await ensureTaskInOverrideForDate({ dateKey, taskId });

  const curPct = Math.max(0, Math.min(100, Math.round(Number(task.donePercent)||0)));
  task.donePercent = (curPct >= 100) ? 0 : 100;
  task.done = task.donePercent >= 100;

  await saveOv(ov);
  return ov.tasks;
}
