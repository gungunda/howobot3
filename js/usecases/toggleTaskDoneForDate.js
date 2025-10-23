// js/usecases/toggleTaskDoneForDate.js
export default async function toggleTaskDoneForDate({ dateKey, taskId }){
  const get = (await import("./getTasksForDate.js")).default;
  const set = (await import("./setTaskPercentForDate.js")).default;
  const tasks = await get({ dateKey });
  const cur = (tasks||[]).find(x=>x.id===taskId)?.donePercent || 0;
  return set({ dateKey, taskId, value: (cur>=100?0:100) });
}
