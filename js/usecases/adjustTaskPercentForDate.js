// js/usecases/adjustTaskPercentForDate.js
// Изменить прогресс задачи (±10%) для конкретной даты.
// Работает и для обычных задач дня, и для задач из "Разгрузки".
// Если задачи нет в override — сначала помещаем её туда.

import ensureTaskInOverrideForDate from "./ensureTaskInOverrideForDate.js";

export default async function adjustTaskPercentForDate({ dateKey, taskId, delta = 0 }){
  const ovRepo = await import("../adapters/smart/smart.override.repo.js");
  const saveOv = ovRepo.saveOverride || ovRepo.save;

  const { ov, task } = await ensureTaskInOverrideForDate({ dateKey, taskId });

  const cur = Math.max(0, Math.min(100, Math.round(Number(task.donePercent)||0)));
  task.donePercent = Math.max(
    0,
    Math.min(100, Math.round(cur + (Number(delta)||0)))
  );
  task.done = task.donePercent >= 100;

  await saveOv(ov);
  return ov.tasks;
}
