// js/usecases/adjustTaskPercentForDate.js
// Увеличить/уменьшить процент выполнения задачи на дату (клиппинг 0..100).

export default async function adjustTaskPercentForDate({ dateKey, taskId, delta = 0 }) {
  const mod = await import("./setTaskPercentForDate.js");
  const setTaskPercentForDate = mod.default || mod.setTaskPercentForDate;
  // Сначала узнаём текущий процент
  const getMod = await import("./getTasksForDate.js");
  const getTasksForDate = getMod.default || getMod.getTasksForDate;
  const tasks = await getTasksForDate({ dateKey });
  const cur = (tasks || []).find(t => t?.id === taskId);
  const current = Number(cur?.donePercent || 0);
  const next = Math.max(0, Math.min(100, Math.round(current + (Number(delta)||0))));
  return setTaskPercentForDate({ dateKey, taskId, value: next });
}
