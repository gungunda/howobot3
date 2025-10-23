// js/usecases/setTaskPercentForDate.js
// Установить точное значение процента выполнения задачи на дату (без поля progress).

export default async function setTaskPercentForDate({ dateKey, taskId, value = 0 }) {
  const editMod = await import("./editTaskInline.js");
  const editTaskInline = editMod.default || editMod.editTaskInline || editMod.run;
  const pct = Math.max(0, Math.min(100, Math.round(Number(value)||0)));
  const done = pct >= 100;
  return editTaskInline({ dateKey, taskId, patch: { donePercent: pct, done } });
}
