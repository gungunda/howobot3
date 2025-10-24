// js/usecases/setTaskPercentForDate.js
// Установить прогресс задачи в процентах (0..100) на конкретную дату.
// Используется реже напрямую, но логика та же — гарантируем, что задача есть в override.

import ensureTaskInOverrideForDate from "./ensureTaskInOverrideForDate.js";

export default async function setTaskPercentForDate({ dateKey, taskId, value = 0 }){
  const ovRepo = await import("../adapters/smart/smart.override.repo.js");
  const saveOv = ovRepo.saveOverride || ovRepo.save;

  const { ov, task } = await ensureTaskInOverrideForDate({ dateKey, taskId });

  task.donePercent = Math.max(
    0,
    Math.min(100, Math.round(Number(value)||0))
  );
  task.done = task.donePercent >= 100;

  await saveOv(ov);
  return ov.tasks;
}
