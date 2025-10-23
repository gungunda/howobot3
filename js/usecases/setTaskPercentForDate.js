// js/usecases/setTaskPercentForDate.js
export default async function setTaskPercentForDate({ dateKey, taskId, value = 0 }){
  const edit = (await import("./editTaskInline.js")).default;
  const pct = Math.max(0, Math.min(100, Math.round(Number(value)||0)));
  const done = pct >= 100;
  return edit({ dateKey, taskId, patch: { donePercent: pct, done } });
}
