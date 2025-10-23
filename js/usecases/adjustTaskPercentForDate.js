// js/usecases/adjustTaskPercentForDate.js
export default async function adjustTaskPercentForDate({ dateKey, taskId, delta = 0 }){
  const setPct = (await import("./setTaskPercentForDate.js")).default;
  const get = (await import("./getTasksForDate.js")).default;
  const tasks = await get({ dateKey });
  const cur = (tasks||[]).find(x=>x.id===taskId)?.donePercent || 0;
  const next = Math.max(0, Math.min(100, Math.round(cur + (Number(delta)||0))));
  return setPct({ dateKey, taskId, value: next });
}
