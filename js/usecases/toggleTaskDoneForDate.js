// js/usecases/toggleTaskDoneForDate.js
// Переключает "готово" для задачи на конкретную дату:
// done -> 0%, not done -> 100%

export default async function toggleTaskDoneForDate({ dateKey, taskId }) {
  const getMod = await import("./getTasksForDate.js");
  const setMod = await import("./setTaskPercentForDate.js");
  const getTasksForDate = getMod.default || getMod.getTasksForDate || getMod.run;
  const setTaskPercentForDate = setMod.default || setMod.setTaskPercentForDate || setMod.run;

  const tasks = await getTasksForDate({ dateKey });
  const t = (tasks || []).find(x => x?.id === taskId);
  const cur = Number(t?.donePercent || 0);
  const next = cur >= 100 ? 0 : 100;
  return setTaskPercentForDate({ dateKey, taskId, value: next });
}
